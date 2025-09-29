import type { Value, Transform, Inputs } from "@eventvisor/types";

import type { Logger } from "./logger";
import type { ConditionsChecker } from "./conditions";
import type { SourceResolver } from "./sourceResolver";

export type GetTransformer = () => Transformer;

export interface TransformerOptions {
  logger: Logger;
  conditionsChecker: ConditionsChecker;
  sourceResolver: SourceResolver;
}

export class Transformer {
  private logger: Logger;
  private conditionsChecker: ConditionsChecker;
  private sourceResolver: SourceResolver;

  constructor(options: TransformerOptions) {
    this.logger = options.logger;
    this.conditionsChecker = options.conditionsChecker;
    this.sourceResolver = options.sourceResolver;
  }

  async applyAll(value: Value, transforms: Transform[], inputs: Inputs = {}): Promise<Value> {
    let result = value;

    for (const transform of transforms) {
      /**
       * Conditions
       */
      if (transform.conditions) {
        const conditionMatched = await this.conditionsChecker.allAreMatched(
          transform.conditions,
          inputs,
        );

        if (!conditionMatched) {
          continue;
        }
      }

      /**
       * Source value
       */
      let sourceValue = await this.sourceResolver.resolve(transform, inputs);

      // when Transform has no source, but only target
      if (sourceValue === null || sourceValue === undefined) {
        if (transform.target) {
          sourceValue = await this.sourceResolver.resolve(
            {
              payload: transform.target,
            },
            typeof inputs.payload === "undefined"
              ? {
                  ...inputs,
                  payload: value,
                }
              : inputs,
          );
        }
      }

      /**
       * Transform value
       */
      // plain target
      if (transform.target) {
        // @TODO: target is always single string. tidy it up
        const targets = Array.isArray(transform.target) ? transform.target : [transform.target];

        for (const target of targets) {
          // @TODO: use if/elseif below later

          // string only
          if (typeof sourceValue === "string") {
            if (transform.type === "trim") {
              result = Transformer.setValueAtPath(result, target, sourceValue.trim());
            }
          }

          // array only
          if (Array.isArray(sourceValue)) {
            if (transform.type === "concat") {
              const separator = transform.separator || " ";
              result = Transformer.setValueAtPath(result, target, sourceValue.join(separator));
            }
          }

          // others
          if (transform.type === "set") {
            if ("value" in transform) {
              result = Transformer.setValueAtPath(result, target, transform.value);
            } else {
              result = Transformer.setValueAtPath(result, target, sourceValue);
            }
          }

          if (transform.type === "remove") {
            result = Transformer.removeValueAt(result, target);
          }

          // to other types
          if (transform.type === "toInteger") {
            result = Transformer.setValueAtPath(result, target, parseInt(String(sourceValue)));
          } else if (transform.type === "toDouble") {
            result = Transformer.setValueAtPath(result, target, parseFloat(String(sourceValue)));
          } else if (transform.type === "toString") {
            result = Transformer.setValueAtPath(result, target, String(sourceValue) || "");
          } else if (transform.type === "toBoolean") {
            const lowerCasedValue = String(sourceValue).toLowerCase();

            result = Transformer.setValueAtPath(
              result,
              target,
              ["true", "1", "checked", "yes", "on", "y"].indexOf(lowerCasedValue) !== -1 ||
                sourceValue === true,
            );
          }
        }
      } else {
        // without target (meaning, self)

        // set
        if (transform.type === "set") {
          if ("value" in transform) {
            result = transform.value;
          }
        }
      }

      if (transform.type === "spread") {
        if (transform.target) {
          const currentTargetValue = Transformer.getValueAtPath(result, transform.target);
          result = Transformer.setValueAtPath(result, transform.target, {
            ...((currentTargetValue as object) || {}),
            ...((sourceValue as object) || {}),
          });
        } else {
          result = {
            ...((result as object) || {}),
            ...((sourceValue as object) || {}),
          };
        }
      }

      // mathematical
      if (transform.type === "increment") {
        const by = typeof transform.value === "number" ? transform.value : 1;

        if (transform.target) {
          result = Transformer.setValueAtPath(result, transform.target, Number(sourceValue) + by);
        } else {
          result = (result as number) + by;
        }
      } else if (transform.type === "decrement") {
        const by = typeof transform.value === "number" ? transform.value : 1;

        if (transform.target) {
          result = Transformer.setValueAtPath(result, transform.target, Number(sourceValue) - by);
        } else {
          result = (result as number) - by;
        }
      }

      // target map
      if (transform.targetMap) {
        const targetMaps: Record<string, string>[] = [];

        // @TODO: tidy it up
        if (Array.isArray(transform.targetMap)) {
          for (const targetMap of transform.targetMap) {
            Object.entries(targetMap).forEach(([key, value]) => {
              targetMaps.push({ [key]: value });
            });
          }
        } else {
          Object.entries(transform.targetMap).forEach(([key, value]) => {
            targetMaps.push({ [key]: value });
          });
        }

        for (const targetMap of targetMaps) {
          // rename
          if (transform.type === "rename") {
            result = Transformer.renameValueAt(result, targetMap as Record<string, string>);
          }
        }
      }
    }

    return result;
  }

  // Helper function to rename value at path
  public static renameValueAt(obj: any, target: Record<string, string>): any {
    if (!obj || typeof obj !== "object") return obj;
    if (!target || typeof target !== "object") return obj;

    const entries = Object.entries(target);
    if (entries.length === 0) return obj;

    const [oldKey, newKey] = entries[0];
    if (!oldKey || !newKey) return obj;

    // Get the value at old path
    const oldValue = Transformer.getValueAtPath(obj, oldKey);
    if (oldValue === undefined) return obj;

    // Create a copy to avoid mutating the original
    const result = JSON.parse(JSON.stringify(obj));

    // Remove old property
    const oldKeys = oldKey.split(".");
    let current = result;

    // Navigate to parent of old property
    for (let i = 0; i < oldKeys.length - 1; i++) {
      const key = oldKeys[i];
      if (current[key] === undefined) return result;
      current = current[key];
    }

    // Remove old property
    delete current[oldKeys[oldKeys.length - 1]];

    // Set at new path
    return Transformer.setValueAtPath(result, newKey, oldValue);
  }

  // Helper function to get value at path
  public static getValueAtPath(obj: any, path: string): any {
    if (!path || typeof path !== "string") return undefined;

    const keys = path.split(".");
    let current = obj;

    for (const key of keys) {
      if (current === null || current === undefined) return undefined;
      if (typeof current === "object" && !Array.isArray(current)) {
        current = (current as any)[key];
      } else if (Array.isArray(current) && /^\d+$/.test(key)) {
        current = current[parseInt(key)];
      } else {
        return undefined;
      }
    }

    return current;
  }

  // Helper function to set value at path
  public static setValueAtPath(obj: any, path: string, value: any): any {
    if (!path || typeof path !== "string") return obj;
    if (obj === null || obj === undefined) return obj;

    // Create a copy to avoid mutating the original
    const result = JSON.parse(JSON.stringify(obj));
    const keys = path.split(".");
    let current = result as any;

    // Navigate to the parent of the target path
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (current[key] === undefined) {
        // Create nested object or array as needed
        if (/^\d+$/.test(keys[i + 1])) {
          current[key] = [];
        } else {
          current[key] = {};
        }
      }
      current = current[key];
    }

    // Set the final value
    const finalKey = keys[keys.length - 1];
    current[finalKey] = value;

    return result;
  }

  // Helper function to remove value at path
  public static removeValueAt(obj: any, path: string): any {
    if (!path || typeof path !== "string") return obj;
    if (obj === null || obj === undefined) return obj;

    // Create a copy to avoid mutating the original
    const result = JSON.parse(JSON.stringify(obj));
    const keys = path.split(".");
    let current = result as any;

    // Navigate to the parent of the target path
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (current[key] === undefined) {
        return result; // Path doesn't exist, nothing to remove
      }
      current = current[key];
    }

    // Remove the property
    const finalKey = keys[keys.length - 1];
    if (Array.isArray(current)) {
      if (/^\d+$/.test(finalKey)) {
        current.splice(parseInt(finalKey), 1);
      }
    } else if (typeof current === "object" && current !== null) {
      delete current[finalKey];
    }

    return result;
  }
}
