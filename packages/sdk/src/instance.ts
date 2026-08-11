import {
  AttributeName,
  DatafileContent,
  EventLevel,
  EventName,
  EffectName,
  OnValidationFailure,
  Value,
} from "@eventvisor/types";

import {
  emptyDatafile,
  getComplexPersists,
  mergeDatafiles,
  parseDatafile,
  type DatafileInput,
  type InstanceDataProvider,
} from "./datafile.js";
import {
  createLogger,
  Logger,
  LogLevel,
  type EventvisorDiagnostic,
  type EventvisorDiagnosticHandler,
} from "./logger.js";
import { Emitter, EmitType, EventCallback } from "./emitter.js";
import { AttributesManager } from "./attributesManager.js";
import { EventvisorModule, ModuleName, ModulesManager } from "./modulesManager.js";
import { SourceResolver } from "./sourceResolver.js";
import { ConditionsChecker } from "./conditions.js";
import { Bucketer } from "./bucketer.js";
import { Transformer } from "./transformer.js";
import { Validator } from "./validator.js";
import { EffectsManager } from "./effectsManager.js";
import { isTransportSafeValue } from "./portable.js";

export interface EventvisorOptions {
  datafile?: DatafileInput;
  logLevel?: LogLevel;
  onDiagnostic?: EventvisorDiagnosticHandler;
  modules?: EventvisorModule[];
  initialAttributes?: Record<AttributeName, Value>;
}

export class Eventvisor {
  private datafile: DatafileContent;
  private regexCache: Record<string, RegExp> = {};
  private logger: Logger;
  private emitter: Emitter;
  private attributesManager: AttributesManager;
  private modulesManager: ModulesManager;
  private effectsManager: EffectsManager;
  private sourceResolver: SourceResolver;
  private conditionsChecker: ConditionsChecker;
  private transformer: Transformer;
  private bucketer: Bucketer;
  private validator: Validator;

  private ready: boolean = false;
  private readyPromise: Promise<void>;
  private diagnosticHandlers: EventvisorDiagnosticHandler[] = [];
  private closed = false;
  private operationQueue: Promise<void> = Promise.resolve();

  constructor(options: EventvisorOptions = {}) {
    /** Core services that do not depend on another runtime service. */
    this.emitter = new Emitter();
    if (options.onDiagnostic) this.diagnosticHandlers.push(options.onDiagnostic);
    this.logger = createLogger({
      level: options.logLevel || Logger.defaultLevel,
      onDiagnostic: (diagnostic) => this.reportDiagnostic(diagnostic),
    });

    try {
      this.datafile = parseDatafile(options.datafile || emptyDatafile);
    } catch (error) {
      this.datafile = emptyDatafile;
      this.logger.error((error as Error).message, { code: "invalid_datafile", error });
    }

    /** Runtime services are wired through lazy accessors where their responsibilities cross. */
    this.modulesManager = new ModulesManager({
      logger: this.logger,
      getRevision: () => this.getRevision(),
      onDiagnostic: (handler) => this.onDiagnostic(handler),
      reportDiagnostic: (diagnostic) => this.reportDiagnostic(diagnostic),
      track: (eventName, payload) => this.trackWithEffectChain(eventName, payload, []),
    });

    this.validator = new Validator({
      logger: this.logger,
      getSourceResolver: () => this.sourceResolver,
    });

    this.attributesManager = new AttributesManager({
      logger: this.logger,
      emitter: this.emitter,
      validator: this.validator,
      getDataProvider: () => this as unknown as InstanceDataProvider,
      getTransformer: () => this.transformer,
      getConditionsChecker: () => this.conditionsChecker,
      modulesManager: this.modulesManager,
    });

    this.effectsManager = new EffectsManager({
      logger: this.logger,
      getDataProvider: () => this as unknown as InstanceDataProvider,
      getTransformer: () => this.transformer,
      getConditionsChecker: () => this.conditionsChecker,
      modulesManager: this.modulesManager,
      track: (eventName, payload, effectChain) =>
        this.trackWithEffectChain(eventName, payload, effectChain),
    });

    this.sourceResolver = new SourceResolver({
      logger: this.logger,
      modulesManager: this.modulesManager,
      attributesManager: this.attributesManager,
      effectsManager: this.effectsManager,
    });

    this.conditionsChecker = new ConditionsChecker({
      logger: this.logger,
      getRegex: (regexString, regexFlags) => this.getRegex(regexString, regexFlags),
      sourceResolver: this.sourceResolver,
    });

    this.transformer = new Transformer({
      logger: this.logger,
      conditionsChecker: this.conditionsChecker,
      sourceResolver: this.sourceResolver,
    });

    this.bucketer = new Bucketer({
      logger: this.logger,
      sourceResolver: this.sourceResolver,
      conditionsChecker: this.conditionsChecker,
    });

    /**
     * Ready
     */
    if (options.modules) {
      for (const module of options.modules) {
        this.modulesManager.addModule(module);
      }
    }

    this.readyPromise = Promise.all([
      this.effectsManager.initialize(),
      this.attributesManager.initialize(),
    ])
      .then(async () => {
        for (const [name, value] of Object.entries(options.initialAttributes || {})) {
          await this.attributesManager.setAttribute(name, value);
        }
        this.ready = true;
        this.emitter.trigger("ready", {});
        this.logger.debug("Eventvisor SDK is ready");
      })
      .catch((error) => {
        this.logger.error("Eventvisor initialization failed", {
          code: "initialization_failed",
          error,
        });
        throw error;
      });

    this.logger.info("Eventvisor SDK initialized");
  }

  isReady() {
    return this.ready;
  }

  async onReady(): Promise<void> {
    return this.readyPromise;
  }

  onDiagnostic(handler: EventvisorDiagnosticHandler) {
    this.diagnosticHandlers.push(handler);
    let active = true;
    return () => {
      if (!active) return;
      active = false;
      const index = this.diagnosticHandlers.indexOf(handler);
      if (index !== -1) this.diagnosticHandlers.splice(index, 1);
    };
  }

  private reportDiagnostic(diagnostic: EventvisorDiagnostic) {
    for (const handler of [...this.diagnosticHandlers]) {
      try {
        handler(diagnostic);
      } catch {
        // diagnostic handlers must never interrupt SDK behavior
      }
    }
    if (diagnostic.level === "error" || diagnostic.level === "fatal") {
      this.emitter.trigger("error", { diagnostic });
    }
  }

  getRevision() {
    return this.datafile.revision;
  }

  getSchemaVersion() {
    return this.datafile.schemaVersion;
  }

  setLogLevel(level: LogLevel) {
    return this.logger.setLevel(level);
  }

  private runOperation<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.operationQueue.then(operation, operation);
    this.operationQueue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  setDatafile(datafile: DatafileInput, replace = false) {
    return this.runOperation(async () => {
      await this.onReady();
      try {
        const parsed = parseDatafile(datafile);
        this.datafile = replace ? parsed : mergeDatafiles(this.datafile, parsed);
        this.regexCache = {};
        this.conditionsChecker.clearParsedConditions();
        await Promise.all([this.effectsManager.refresh(), this.attributesManager.refresh()]);
        this.emitter.trigger("datafile_set", { replaced: replace });
      } catch (error) {
        this.logger.error((error as Error).message || "Could not parse datafile", {
          code: "invalid_datafile",
          error,
        });
      }
    });
  }

  private getAttribute(name: AttributeName) {
    return this.datafile.attributes[name];
  }
  private getAttributeNames() {
    return Object.keys(this.datafile.attributes);
  }
  private getEvent(name: EventName) {
    return this.datafile.events[name];
  }
  private getDestination(name: string) {
    return this.datafile.destinations[name];
  }
  private getDestinationNames() {
    return Object.keys(this.datafile.destinations);
  }
  private getEffect(name: EffectName) {
    return this.datafile.effects[name];
  }
  private getEffectNames() {
    return Object.keys(this.datafile.effects);
  }
  private getRegex(pattern: string, flags = "") {
    const key = `${pattern}-${flags}`;
    return this.regexCache[key] || (this.regexCache[key] = new RegExp(pattern, flags));
  }
  private getPersists(schema: any) {
    return schema && schema.persist ? getComplexPersists(schema.persist) : null;
  }

  on<T extends EmitType>(emitType: T, callback: EventCallback<T>) {
    return this.emitter.on(emitType, callback);
  }

  /**
   * Attribute
   */
  setAttribute(attributeName: AttributeName, value: Value) {
    return this.runOperation(() => this.setAttributeInternal(attributeName, value));
  }

  private async setAttributeInternal(attributeName: AttributeName, value: Value) {
    await this.onReady();
    const result = await this.attributesManager.setAttribute(attributeName, value);

    /**
     * Effects
     */
    await this.effectsManager.dispatch({
      eventType: "attribute_set",
      name: attributeName,
      value: result,
    });

    return result;
  }

  getAttributeValue(attributeName: AttributeName) {
    return this.attributesManager.getAttributeValue(attributeName);
  }

  getAttributes() {
    return { ...this.attributesManager.getAttributesMap() };
  }

  isAttributeSet(attributeName: AttributeName) {
    return this.attributesManager.isAttributeSet(attributeName);
  }

  removeAttribute(attributeName: AttributeName) {
    return this.runOperation(async () => {
      await this.onReady();
      return this.attributesManager.removeAttribute(attributeName);
    });
  }

  /**
   * Modules
   */
  addModule(module: EventvisorModule) {
    return this.modulesManager.addModule(module);
  }

  removeModule(moduleName: ModuleName) {
    return this.runOperation(() => this.modulesManager.removeModule(moduleName));
  }

  flush() {
    return this.runOperation(() => this.modulesManager.flush());
  }

  private async quarantineInvalidEvent(
    eventName: EventName,
    eventLevel: EventLevel,
    value: Value,
    error: Error | undefined,
    policy: Extract<OnValidationFailure, { action: "quarantine" }>,
    validationErrors: Array<{ path: string; message: string }>,
  ) {
    const destination = this.getDestination(policy.destination);
    if (!destination) {
      this.logger.error("Validation quarantine destination not found", {
        code: "quarantine_destination_not_found",
        eventName,
        destinationName: policy.destination,
      });
      return;
    }
    if (!this.modulesManager.transportExists(destination.transport)) {
      this.logger.error("Validation quarantine destination has no transport", {
        code: "quarantine_transport_not_found",
        eventName,
        destinationName: policy.destination,
      });
      return;
    }

    await this.modulesManager.transport(destination.transport, {
      destinationName: policy.destination,
      eventName,
      eventLevel,
      revision: this.getRevision(),
      payload: {
        eventName,
        payload: value,
        validationErrors,
        revision: this.getRevision(),
      },
      error,
      validation: { valid: false, errors: validationErrors },
    });
  }

  /**
   * Event
   */
  track(eventName: EventName, value: Value): Promise<Value | null> {
    return this.runOperation(() => this.trackWithEffectChain(eventName, value, []));
  }

  private async trackWithEffectChain(
    eventName: EventName,
    value: Value,
    effectChain: EffectName[],
  ): Promise<Value | null> {
    await this.onReady();
    /**
     * Find
     */
    const eventSchema = this.getEvent(eventName);

    if (!eventSchema) {
      this.logger.error(`Event schema not found in datafile`, {
        code: "event_not_found",
        eventName,
      });

      return null;
    }

    const eventLevel = eventSchema.level || "info";

    /**
     * Deprecated
     */
    if (eventSchema.deprecated) {
      this.logger.warn(`Event is deprecated`, { code: "event_deprecated", eventName });
    }

    /**
     * Validate
     */
    let shouldValidate = true;

    if (typeof eventSchema.skipValidation !== "undefined") {
      if (eventSchema.skipValidation === true) {
        // boolean
        shouldValidate = false;
      } else if (
        typeof eventSchema.skipValidation === "object" &&
        eventSchema.skipValidation.conditions
      ) {
        const isMatched = await this.conditionsChecker.allAreMatched(
          eventSchema.skipValidation.conditions,
          {
            eventName,
            eventLevel,
            payload: value,
          },
        );

        if (isMatched) {
          shouldValidate = false;
        }
      }
    }

    if (eventSchema.requiredAttributes) {
      const missingAttributes = eventSchema.requiredAttributes.filter(
        (attributeName) => !this.attributesManager.isAttributeSet(attributeName),
      );
      if (missingAttributes.length > 0) {
        this.logger.warn("Event required attributes are not set", {
          code: "required_attributes_missing",
          eventName,
          missingAttributes,
        });
        return null;
      }
    }

    let validatedValue: Value | undefined = undefined;
    let validationFailure:
      { valid: false; errors: Array<{ path: string; message: string }> } | undefined;
    const error = value instanceof Error ? value : undefined;

    if (shouldValidate) {
      const validationResult = await this.validator.validate(eventSchema, value);

      if (!validationResult.valid) {
        const errors = (validationResult.errors || []).map(({ path, message }) => ({
          path,
          message,
        }));
        this.logger.warn(`Event validation failed`, {
          code: "event_validation_failed",
          eventName,
          errors: validationResult.errors,
        });
        const policy =
          eventSchema.onValidationFailure || this.datafile.onValidationFailure || "drop";
        if (policy === "drop") return null;
        if (typeof policy === "object" && policy.action === "quarantine") {
          await this.quarantineInvalidEvent(eventName, eventLevel, value, error, policy, errors);
          return null;
        }
        validationFailure = { valid: false, errors };
        validatedValue = value;
      } else {
        validatedValue = validationResult.value;
      }
    } else {
      this.logger.debug(`Event validation skipped`, {
        eventName,
      });
      validatedValue = value;
    }

    /**
     * Conditions
     */
    if (eventSchema.conditions) {
      const isMatched = await this.conditionsChecker.allAreMatched(eventSchema.conditions, {
        eventName,
        eventLevel,
        payload: validatedValue,
      });

      if (!isMatched) {
        this.logger.debug(`Event conditions not matched`, {
          eventName,
          conditions: eventSchema.conditions,
        });

        return null;
      }
    }

    /**
     * Sample
     */
    if (eventSchema.sample) {
      const sampleResult = await this.bucketer.isSampled(eventSchema.sample, {
        eventName,
        eventLevel,
        payload: validatedValue,
      });

      if (!sampleResult.isSampled) {
        this.logger.debug(`Event sample not matched`, {
          eventName,
          matchedSample: sampleResult.matchedSample,
          bucketedNumber: sampleResult.bucketedNumber,
          bucketKey: sampleResult.bucketKey,
        });

        return null;
      }
    }

    /**
     * Transform
     */
    let transformedValue = validatedValue;

    if (eventSchema.transforms) {
      transformedValue = await this.transformer.applyAll(validatedValue, eventSchema.transforms, {
        eventName,
        eventLevel,
        payload: validatedValue,
      });
    }

    if (!isTransportSafeValue(transformedValue)) {
      this.logger.error("Event transform produced a value that cannot be transported safely", {
        code: "transform_output_invalid",
        eventName,
      });
      return null;
    }

    /**
     * Effects
     */
    await this.effectsManager.dispatch(
      {
        eventType: "event_tracked",
        name: eventName,
        value: transformedValue,
      },
      effectChain,
    );

    /**
     * Destinations
     */
    const destinationNames = this.getDestinationNames();

    await Promise.all(
      destinationNames.map(async (destinationName) => {
        const destination = this.getDestination(destinationName);

        if (!destination) {
          return;
        }

        const transportExists = this.modulesManager.transportExists(destination.transport);

        if (!transportExists) {
          this.logger.error(`Destination has no transport`, {
            code: "destination_transport_not_found",
            eventName,
            destinationName,
          });

          return;
        }

        let transportBody = transformedValue;

        /**
         * Event.destinations
         */
        if (
          eventSchema.destinations &&
          typeof eventSchema.destinations[destinationName] !== "undefined"
        ) {
          const destinationOverride = eventSchema.destinations[destinationName];

          if (destinationOverride === false) {
            this.logger.debug(`Event has destination disabled`, {
              eventName,
              destinationName,
            });

            return;
          } else if (typeof destinationOverride === "object") {
            // conditions
            if (destinationOverride.conditions) {
              const isMatched = await this.conditionsChecker.allAreMatched(
                destinationOverride.conditions,
                {
                  eventName,
                  eventLevel,
                  payload: transportBody,
                },
              );

              if (!isMatched) {
                this.logger.debug(`Destination conditions not matched for event`, {
                  eventName,
                  destinationName,
                });

                return;
              }
            }

            // sample
            if (destinationOverride.sample) {
              const sampleResult = await this.bucketer.isSampled(destinationOverride.sample, {
                eventName,
                eventLevel,
                payload: transportBody,
              });

              if (!sampleResult.isSampled) {
                this.logger.debug(`Destination sample not matched for event`, {
                  eventName,
                  destinationName,
                  matchedSample: sampleResult.matchedSample,
                  bucketedNumber: sampleResult.bucketedNumber,
                  bucketKey: sampleResult.bucketKey,
                });

                return;
              }
            }

            // transform
            if (destinationOverride.transforms) {
              transportBody = await this.transformer.applyAll(
                transformedValue,
                destinationOverride.transforms,
                {
                  eventName,
                  eventLevel,
                  payload: transportBody,
                },
              );
            }
          }
        }

        /**
         * Destination itself
         */

        // conditions
        if (destination.conditions) {
          const isMatched = await this.conditionsChecker.allAreMatched(destination.conditions, {
            eventName,
            eventLevel,
            payload: transformedValue,
          });

          if (!isMatched) {
            this.logger.debug(`Destination conditions not matched`, {
              eventName,
              destinationName,
            });

            return;
          }
        }

        // sample
        if (destination.sample) {
          const sampleResult = await this.bucketer.isSampled(destination.sample, {
            eventName,
            eventLevel,
            payload: transportBody,
          });

          if (!sampleResult.isSampled) {
            this.logger.debug(`Destination sample not matched`, {
              eventName,
              destinationName,
            });

            return;
          }
        }

        // transform
        if (destination.transforms) {
          transportBody = await this.transformer.applyAll(transportBody, destination.transforms, {
            eventName,
            eventLevel,
            payload: transportBody,
            destinationName,
            attributes: this.attributesManager.getAttributesMap(),
          });
        }

        if (!isTransportSafeValue(transportBody)) {
          this.logger.error(
            "Destination transform produced a value that cannot be transported safely",
            {
              code: "transform_output_invalid",
              eventName,
              destinationName,
            },
          );
          return;
        }

        await this.modulesManager.transport(destination.transport, {
          destinationName,
          eventName,
          eventLevel,
          revision: this.getRevision(),
          payload: transportBody,
          error,
          validation: validationFailure,
        });
      }),
    );

    this.emitter.trigger("event_tracked", { eventName, value: transformedValue });
    return transformedValue;
  }

  /**
   * Effect's state
   */
  getStateValue(name: EffectName) {
    return this.effectsManager.getStateValue(name);
  }

  spawn(options: Omit<EventvisorOptions, "datafile"> = {}) {
    return createEventvisor({ ...options, datafile: this.datafile });
  }

  close() {
    return this.runOperation(async () => {
      if (this.closed) return;
      this.closed = true;
      try {
        await this.onReady();
      } catch {
        // Initialization already reported its diagnostic. Continue cleanup.
      }
      await this.modulesManager.close();
      this.emitter.clearAll();
      this.diagnosticHandlers = [];
    });
  }
}

export function createEventvisor(options: EventvisorOptions = {}): Eventvisor {
  return new Eventvisor(options);
}
