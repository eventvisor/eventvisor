import { AttributeName, DatafileContent, EventName, EffectName, Value } from "@eventvisor/types";

import {
  emptyDatafile,
  getComplexPersists,
  mergeDatafiles,
  parseDatafile,
  type DatafileInput,
  type InstanceDataProvider,
} from "./datafile";
import {
  createLogger,
  Logger,
  LogLevel,
  type EventvisorDiagnostic,
  type EventvisorDiagnosticHandler,
} from "./logger";
import { Emitter, EmitType, EventCallback } from "./emitter";
import { AttributesManager } from "./attributesManager";
import { EventvisorModule, ModuleName, ModulesManager } from "./modulesManager";
import { SourceResolver } from "./sourceResolver";
import { ConditionsChecker } from "./conditions";
import { Bucketer } from "./bucketer";
import { Transformer } from "./transformer";
import { Validator } from "./validator";
import { EffectsManager } from "./effectsManager";

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

  constructor(options: EventvisorOptions = {}) {
    /**
     * Core instances without interdependencies
     *
     * @TODO: sort out this dependency mess!!
     */
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

    /**
     * Instances with interdependencies
     */
    this.modulesManager = new ModulesManager({
      logger: this.logger,
      getRevision: () => this.getRevision(),
      onDiagnostic: (handler) => this.onDiagnostic(handler),
      reportDiagnostic: (diagnostic) => this.reportDiagnostic(diagnostic),
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

  async setDatafile(datafile: DatafileInput, replace = false) {
    try {
      const parsed = parseDatafile(datafile);
      this.datafile = replace ? parsed : mergeDatafiles(this.datafile, parsed);
      this.regexCache = {};
      await Promise.all([this.effectsManager.refresh(), this.attributesManager.refresh()]);
      this.emitter.trigger("datafile_set", { replaced: replace });
    } catch (error) {
      this.logger.error((error as Error).message || "Could not parse datafile", {
        code: "invalid_datafile",
        error,
      });
    }
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
  async setAttribute(attributeName: AttributeName, value: Value) {
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

  async removeAttribute(attributeName: AttributeName) {
    await this.onReady();
    return this.attributesManager.removeAttribute(attributeName);
  }

  /**
   * Modules
   */
  addModule(module: EventvisorModule) {
    return this.modulesManager.addModule(module);
  }

  removeModule(moduleName: ModuleName) {
    return this.modulesManager.removeModule(moduleName);
  }

  /**
   * Event
   */
  async track(eventName: EventName, value: Value): Promise<Value | null> {
    await this.onReady();
    /**
     * Find
     */
    const eventSchema = this.getEvent(eventName);

    if (!eventSchema) {
      this.logger.error(`Event schema not found in datafile`, { eventName });

      return null; // @TODO: allow to continue based on SDK instance options later
    }

    const eventLevel = eventSchema.level || "info";

    /**
     * Deprecated
     */
    if (eventSchema.deprecated) {
      this.logger.warn(`Event is deprecated`, { eventName });
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
          eventName,
          missingAttributes,
        });
        return null;
      }
    }

    let validatedValue: Value | undefined = undefined;
    let error = value instanceof Error ? value : undefined;

    if (shouldValidate) {
      const validationResult = await this.validator.validate(eventSchema, value);

      if (!validationResult.valid) {
        this.logger.warn(`Event validation failed`, {
          eventName,
          errors: validationResult.errors,
        });

        return null; // @TODO: allow to continue based on schema later
      }

      validatedValue = validationResult.value;
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
        // @TODO: rename to eventPayload to be explicit?
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

    /**
     * Effects
     */
    await this.effectsManager.dispatch({
      eventType: "event_tracked",
      name: eventName,
      value: transformedValue,
    });

    /**
     * Destinations
     */
    const destinationNames = this.getDestinationNames();

    for (const destinationName of destinationNames) {
      const destination = this.getDestination(destinationName);

      if (!destination) {
        continue;
      }

      const transportExists = this.modulesManager.transportExists(destination.transport);

      if (!transportExists) {
        this.logger.error(`Destination has no transport`, {
          eventName,
          destinationName,
        });

        continue;
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

          continue;
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

              continue;
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

              continue;
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

          continue;
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

          continue;
        }
      }

      // transform
      if (destination.transforms) {
        transportBody = await this.transformer.applyAll(transportBody, destination.transforms, {
          eventName,
          eventLevel,
          payload: transportBody,
          destinationName,
          attributes: this.attributesManager.getAttributesMap(), // @TODO: check if needed
        });
      }

      // hand over to module for transporting
      // @TODO: decide about "await" or not
      // @TODO: batch
      // @TODO: retry
      await this.modulesManager.transport(
        destination.transport,
        destinationName,
        eventName,
        transportBody,
        eventLevel,
        error,
      );
    }

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

  async close() {
    if (this.closed) return;
    this.closed = true;
    await this.modulesManager.close();
    this.emitter.clearAll();
    this.diagnosticHandlers = [];
  }
}

export function createEventvisor(options: EventvisorOptions = {}): Eventvisor {
  return new Eventvisor(options);
}
