import {
  AttributeName,
  DatafileContent,
  EventName,
  EffectName,
  Value,
  Action,
} from "@eventvisor/types";

import { DatafileReader, emptyDatafile } from "./datafileReader";
import { createLogger, Logger, LogLevel } from "./logger";
import { Emitter, EmitType, EventCallback } from "./emitter";
import { AttributesManager } from "./attributesManager";
import { Module, ModuleName, ModulesManager } from "./modulesManager";
import { SourceResolver } from "./sourceResolver";
import { ConditionsChecker } from "./conditions";
import { Bucketer } from "./bucketer";
import { Transformer } from "./transformer";
import { Validator } from "./validator";
import { EffectsManager } from "./effectsManager";

export interface InstanceOptions {
  datafile?: DatafileContent;
  logLevel?: LogLevel;
  logger?: Logger;
  modules?: Module[];

  // @TODO
  // initialAttributes?: Record<AttributeName, Value>;
}

export class Eventvisor {
  private datafileReader: DatafileReader;
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
  private queue: Action[] = [];
  private queueProcessing: boolean = false;

  constructor(options: InstanceOptions = {}) {
    /**
     * Core instances without interdependencies
     *
     * @TODO: sort out this dependency mess!!
     */
    this.logger =
      options.logger ||
      createLogger({
        level: options.logLevel || Logger.defaultLevel,
      });

    this.datafileReader = new DatafileReader({
      datafile: options.datafile || emptyDatafile,
      logger: this.logger,
    });

    this.emitter = new Emitter();

    /**
     * Instances with interdependencies
     */
    this.modulesManager = new ModulesManager({
      logger: this.logger,
      getDatafileReader: () => this.datafileReader,
      getSourceResolver: () => this.sourceResolver,
    });

    this.validator = new Validator({
      logger: this.logger,
      getSourceResolver: () => this.sourceResolver,
    });

    this.attributesManager = new AttributesManager({
      logger: this.logger,
      emitter: this.emitter,
      validator: this.validator,
      getDatafileReader: () => this.datafileReader,
      getTransformer: () => this.transformer,
      getConditionsChecker: () => this.conditionsChecker,
      modulesManager: this.modulesManager,
    });

    this.effectsManager = new EffectsManager({
      logger: this.logger,
      getDatafileReader: () => this.datafileReader,
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
      getRegex: (regexString, regexFlags) => this.datafileReader.getRegex(regexString, regexFlags),
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
      transformer: this.transformer,
    });

    /**
     * Ready
     */
    if (options.modules) {
      for (const module of options.modules) {
        this.modulesManager.registerModule(module);
      }
    }

    Promise.all([this.effectsManager.initialize(), this.attributesManager.initialize()])
      .then(() => {
        this.ready = true;
        this.emitter.trigger("ready");
        this.logger.debug("Eventvisor SDK is ready");
      })
      .catch((error) => {
        this.logger.error("initialization failed", error);
      });

    this.logger.info("Eventvisor SDK initialized");
  }

  isReady() {
    return this.ready;
  }

  async onReady(): Promise<void> {
    if (this.ready) {
      return;
    }

    return new Promise((resolve) => {
      const unsubscribe = this.emitter.on("ready", () => {
        unsubscribe();
        resolve();
      });
    });
  }

  getRevision() {
    return this.datafileReader.getRevision();
  }

  setLogLevel(level: LogLevel) {
    return this.logger.setLevel(level);
  }

  setDatafile(datafile: DatafileContent) {
    try {
      const newDatafileReader = new DatafileReader({
        datafile,
        logger: this.logger,
      });

      this.datafileReader = newDatafileReader;

      this.effectsManager.refresh();

      this.emitter.trigger("datafile_set");
    } catch (error) {
      this.logger.error("Error setting datafile", {
        error,
      });
    }
  }

  on(emitType: EmitType, callback: EventCallback) {
    return this.emitter.on(emitType, callback);
  }

  /**
   * Queue
   */
  private addToQueue(action: Action) {
    this.queue.push(action);
  }

  // @TODO: make it better
  private async processQueue() {
    if (this.queue.length === 0) {
      return;
    }

    if (this.queueProcessing) {
      return;
    }

    this.queueProcessing = true;

    const action = this.queue.shift();

    if (!action) {
      this.queueProcessing = false;

      return;
    }

    try {
      if (action.type === "track") {
        await this.trackAsync(action.name, action.value);
      } else if (action.type === "setAttribute") {
        await this.setAttributeAsync(action.name, action.value);
      } else if (action.type === "removeAttribute") {
        await this.removeAttributeAsync(action.name);
      } else if (action.type === "removeAttribute") {
        await this.removeAttributeAsync(action.name);
      }
    } catch (error) {
      this.logger.error(`Error processing queue`, {
        error,
        action,
      });
    }

    this.queueProcessing = false;

    await this.processQueue();
  }

  /**
   * Attribute
   */
  async setAttributeAsync(attributeName: AttributeName, value: Value) {
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

  setAttribute(attributeName: AttributeName, value: Value) {
    this.addToQueue({
      type: "setAttribute",
      name: attributeName,
      value,
    });

    this.processQueue();
  }

  getAttributeValue(attributeName: AttributeName) {
    return this.attributesManager.getAttributeValue(attributeName);
  }

  getAttributes() {
    return this.attributesManager.getAttributesMap();
  }

  isAttributeSet(attributeName: AttributeName) {
    return this.attributesManager.isAttributeSet(attributeName);
  }

  removeAttributeAsync(attributeName: AttributeName) {
    return this.attributesManager.removeAttribute(attributeName);
  }

  removeAttribute(attributeName: AttributeName) {
    this.addToQueue({
      type: "removeAttribute",
      name: attributeName,
    });

    this.processQueue();
  }

  /**
   * Modules
   */
  registerModule(module: Module) {
    return this.modulesManager.registerModule(module);
  }

  removeModule(moduleName: ModuleName) {
    return this.modulesManager.removeModule(moduleName);
  }

  /**
   * Event
   */
  async trackAsync(eventName: EventName, value: Value): Promise<Value | null> {
    /**
     * Find
     */
    const eventSchema = this.datafileReader.getEvent(eventName);

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
    const validationResult = await this.validator.validate(eventSchema, value);

    if (!validationResult.valid) {
      this.logger.warn(`Event validation failed`, {
        eventName,
        errors: validationResult.errors,
      });

      return null; // @TODO: allow to continue based on schema later
    }

    const validatedValue = validationResult.value;

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
    const destinationNames = this.datafileReader.getDestinationNames();

    for (const destinationName of destinationNames) {
      const destination = this.datafileReader.getDestination(destinationName);

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
              // @TODO: make sure this transformed value is only affecting the specific desired destination and not others
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
      );
    }

    return transformedValue;
  }

  track(eventName: EventName, value: Value) {
    this.addToQueue({
      type: "track",
      name: eventName,
      value,
    });

    this.processQueue();
  }

  /**
   * Effect's state
   */
  getStateValue(name: EffectName) {
    return this.effectsManager.getStateValue(name);
  }

  /**
   * @TODO: implement
   */
  spawn() {
    // create child instance here
  }
}

export function createInstance(options: InstanceOptions = {}): Eventvisor {
  return new Eventvisor(options);
}
