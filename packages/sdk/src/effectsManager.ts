import type { EventName, AttributeName, EffectName, Value, EffectOnType } from "@eventvisor/types";

import type { InstanceDataProvider } from "./datafile.js";
import type { Logger } from "./logger.js";
import type { GetTransformer } from "./transformer.js";
import type { GetConditionsChecker } from "./conditions.js";
import type { ModulesManager } from "./modulesManager.js";
import { initializeFromStorage, persistEntity } from "./persister.js";

export type StatesByEffect = Record<EffectName, Value>;

export interface DispatchOptions {
  eventType: EffectOnType;
  name: EventName | AttributeName;
  value: Value;
}

export interface EffectsManagerOptions {
  logger: Logger;
  getDataProvider: () => InstanceDataProvider;
  getTransformer: GetTransformer;
  getConditionsChecker: GetConditionsChecker;
  modulesManager: ModulesManager;
  track?: (
    eventName: EventName,
    payload: Value,
    effectChain: EffectName[],
  ) => Promise<Value | null>;
}

export class EffectsManager {
  private logger: Logger;
  private getDataProvider: () => InstanceDataProvider;
  private getTransformer: GetTransformer;
  private getConditionsChecker: GetConditionsChecker;
  private modulesManager: ModulesManager;
  private track: NonNullable<EffectsManagerOptions["track"]>;

  private statesByEffect: StatesByEffect = {};

  constructor(options: EffectsManagerOptions) {
    this.logger = options.logger;
    this.getDataProvider = options.getDataProvider;
    this.getTransformer = options.getTransformer;
    this.getConditionsChecker = options.getConditionsChecker;
    this.modulesManager = options.modulesManager;
    this.track = options.track || (async () => null);
  }

  async initialize(): Promise<void> {
    const dataProvider = this.getDataProvider();
    const effects = dataProvider.getEffectNames();

    const persistedResult = await initializeFromStorage({
      dataProvider,
      conditionsChecker: this.getConditionsChecker(),
      modulesManager: this.modulesManager,
      storageKeyPrefix: "effects_",
      getEntityNames: () => dataProvider.getEffectNames(),
      getEntity: (entityName: string) => dataProvider.getEffect(entityName),
    });

    for (const effectName of effects) {
      const effect = dataProvider.getEffect(effectName);

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

  async dispatch(dispatchOptions: DispatchOptions, effectChain: EffectName[] = []) {
    // @TODO: rename to actionType
    const { eventType, name, value } = dispatchOptions;

    const dataProvider = this.getDataProvider();
    const conditionsChecker = this.getConditionsChecker();
    const transformer = this.getTransformer();

    const allEffects = dataProvider.getEffectNames();

    for (const effectName of allEffects) {
      const effect = dataProvider.getEffect(effectName);

      if (!effect) {
        continue;
      }

      if (effectChain.includes(effectName)) {
        this.logger.error("Effect re-entrancy blocked", {
          code: "effect_reentrancy_blocked",
          effectName,
          effectChain: [...effectChain, effectName],
        });
        continue;
      }

      const nextEffectChain = [...effectChain, effectName];

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
              await this.modulesManager.handle(
                step.handler,
                effectName,
                effect,
                step,
                value,
                (eventName, payload) => this.track(eventName, payload, nextEffectChain),
              );
            } catch (handlerError) {
              this.logger.error(`Effect handler error`, {
                code: "effect_handler_failed",
                effectName,
                step,
                error: handlerError,
              });

              stepPassed = false;
            }
          }

          // continueOnError
          if (!stepPassed && step.continueOnError !== true) {
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
        dataProvider,
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
  async refresh() {
    const activeNames = new Set(this.getDataProvider().getEffectNames());
    for (const name of Object.keys(this.statesByEffect)) {
      if (!activeNames.has(name)) delete this.statesByEffect[name];
    }
    await this.initialize();
  }

  getAllStates() {
    return this.statesByEffect;
  }

  getStateValue(name: EffectName) {
    return this.statesByEffect[name];
  }
}
