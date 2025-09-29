import type { EventName, AttributeName, EffectName, Value, EffectOnType } from "@eventvisor/types";

import type { GetDatafileReader } from "./datafileReader";
import type { Logger } from "./logger";
import type { GetTransformer } from "./transformer";
import type { GetConditionsChecker } from "./conditions";
import type { ModulesManager } from "./modulesManager";
import { initializeFromStorage, persistEntity } from "./persister";

export type StatesByEffect = Record<EffectName, Value>;

export interface DispatchOptions {
  eventType: EffectOnType;
  name: EventName | AttributeName;
  value: Value;
}

export interface EffectsManagerOptions {
  logger: Logger;
  getDatafileReader: GetDatafileReader;
  getTransformer: GetTransformer;
  getConditionsChecker: GetConditionsChecker;
  modulesManager: ModulesManager;
}

export class EffectsManager {
  private logger: Logger;
  private getDatafileReader: GetDatafileReader;
  private getTransformer: GetTransformer;
  private getConditionsChecker: GetConditionsChecker;
  private modulesManager: ModulesManager;

  private statesByEffect: StatesByEffect = {};

  constructor(options: EffectsManagerOptions) {
    this.logger = options.logger;
    this.getDatafileReader = options.getDatafileReader;
    this.getTransformer = options.getTransformer;
    this.getConditionsChecker = options.getConditionsChecker;
    this.modulesManager = options.modulesManager;
  }

  async initialize(): Promise<void> {
    const datafileReader = this.getDatafileReader();
    const effects = datafileReader.getEffectNames();

    const persistedResult = await initializeFromStorage({
      datafileReader,
      conditionsChecker: this.getConditionsChecker(),
      modulesManager: this.modulesManager,
      storageKeyPrefix: "effects_",
      getEntityNames: () => datafileReader.getEffectNames(),
      getEntity: (entityName: string) => datafileReader.getEffect(entityName),
    });

    for (const effectName of effects) {
      const effect = datafileReader.getEffect(effectName);

      if (!effect) {
        continue;
      }

      if (typeof this.statesByEffect[effectName] !== "undefined") {
        // possibly called via refresh() method after initialization
        continue;
      }

      if (typeof persistedResult[effectName] !== "undefined") {
        // from storage
        this.statesByEffect[effectName] = persistedResult[effectName];
      } else {
        // from initial state of effect
        if (typeof effect.state !== "undefined") {
          if (typeof this.statesByEffect[effectName] === "undefined") {
            this.statesByEffect[effectName] = effect.state;
          }
        }
      }
    }
  }

  async dispatch(dispatchOptions: DispatchOptions) {
    // @TODO: rename to actionType
    const { eventType, name, value } = dispatchOptions;

    const datafileReader = this.getDatafileReader();
    const conditionsChecker = this.getConditionsChecker();
    const transformer = this.getTransformer();

    const allEffects = datafileReader.getEffectNames();

    for (const effectName of allEffects) {
      const effect = datafileReader.getEffect(effectName);

      if (!effect) {
        continue;
      }

      if (eventType === "event_tracked") {
        if (Array.isArray(effect.on) && !effect.on.includes("event_tracked")) {
          continue;
        }

        if (typeof effect.on === "object" && !effect.on["event_tracked"]?.includes(name)) {
          continue;
        }
      }

      if (eventType === "attribute_set") {
        if (Array.isArray(effect.on) && !effect.on.includes("attribute_set")) {
          continue;
        }

        if (typeof effect.on === "object" && !effect.on["attribute_set"]?.includes(name)) {
          continue;
        }
      }

      // conditions
      if (effect.conditions) {
        const isMatched = await conditionsChecker.allAreMatched(effect.conditions, {
          payload: value,
          eventName: eventType === "event_tracked" ? name : undefined,
          attributeName: eventType === "attribute_set" ? name : undefined,
          state: this.statesByEffect[effectName],
        });

        if (!isMatched) {
          continue;
        }
      }

      // steps
      if (effect.steps) {
        for (const step of effect.steps) {
          let stepPassed = true;

          // conditions
          if (step.conditions) {
            const conditionsChecker = this.getConditionsChecker();
            const isMatched = await conditionsChecker.allAreMatched(step.conditions, {
              payload: value,
              eventName: eventType === "event_tracked" ? name : undefined,
              attributeName: eventType === "attribute_set" ? name : undefined,
              state: this.statesByEffect[effectName],
            });

            if (!isMatched) {
              continue;
            }
          }

          // handler
          if (step.handler) {
            try {
              await this.modulesManager.handle(step.handler, effectName, effect, step, value);
            } catch (handlerError) {
              this.logger.error(`Effect handler error`, {
                effectName,
                step,
                error: handlerError,
              });

              stepPassed = false;
            }
          }

          // continueOnError
          if (!stepPassed && typeof step.continueOnError === "boolean" && !step.continueOnError) {
            break;
          }

          // transforms
          if (step.transforms) {
            this.statesByEffect[effectName] = await transformer.applyAll(
              this.statesByEffect[effectName],
              step.transforms,
              {
                eventName: eventType === "event_tracked" ? name : undefined,
                attributeName: eventType === "attribute_set" ? name : undefined,
                state: this.statesByEffect[effectName],
              },
            );
          }
        }
      }

      // persist
      await persistEntity({
        datafileReader,
        conditionsChecker,
        modulesManager: this.modulesManager,
        storageKeyPrefix: "effects_",
        entityName: effectName,
        entity: effect,
        value: this.statesByEffect[effectName],
      });
    }
  }

  // called after datafile refresh
  refresh() {
    // @TODO: think
    this.initialize();
  }

  getAllStates() {
    return this.statesByEffect;
  }

  getStateValue(name: EffectName) {
    return this.statesByEffect[name];
  }
}
