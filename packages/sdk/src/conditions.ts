import type { PlainCondition, Condition, Inputs } from "@eventvisor/types";

import type { SourceResolver } from "./sourceResolver.js";

import { compareVersions } from "./compareVersions.js";
import { Logger } from "./logger.js";

export type GetConditionsChecker = () => ConditionsChecker;
export type GetRegex = (regexString: string, regexFlags?: string) => RegExp;

export interface ConditionsCheckerOptions {
  getRegex: GetRegex;
  sourceResolver: SourceResolver;
  logger: Logger;
}

export class ConditionsChecker {
  private getRegex: GetRegex;
  private sourceResolver: SourceResolver;
  private logger: Logger;

  constructor(options: ConditionsCheckerOptions) {
    this.getRegex = options.getRegex;
    this.sourceResolver = options.sourceResolver;
    this.logger = options.logger;
  }

  async isMatched(condition: PlainCondition, inputs: Inputs): Promise<boolean> {
    const { operator, value, regexFlags } = condition;

    const sourceValue = await this.sourceResolver.resolve(condition, inputs);

    if (operator === "exists") {
      return typeof sourceValue !== "undefined" && sourceValue !== null;
    } else if (operator === "notExists") {
      return typeof sourceValue === "undefined" || sourceValue === null;
    } else if (operator === "equals") {
      return sourceValue === value;
    } else if (operator === "notEquals") {
      return sourceValue !== value;
    } else if (operator === "before" || operator === "after") {
      // date comparisons
      const valueInContext = sourceValue as string | Date;

      const dateInContext =
        valueInContext instanceof Date ? valueInContext : new Date(valueInContext);
      const dateInCondition = value instanceof Date ? value : new Date(value as string);

      return operator === "before"
        ? dateInContext < dateInCondition
        : dateInContext > dateInCondition;
    } else if (
      Array.isArray(value) &&
      (["string", "number"].indexOf(typeof sourceValue) !== -1 || sourceValue === null)
    ) {
      // in / notIn (where condition value is an array)
      const valueInContext = sourceValue as string;

      if (operator === "in") {
        return value.indexOf(valueInContext) !== -1;
      } else if (operator === "notIn") {
        return value.indexOf(valueInContext) === -1;
      }
    } else if (typeof sourceValue === "string" && typeof value === "string") {
      // string
      const valueInContext = sourceValue as string;

      if (operator === "contains") {
        return valueInContext.indexOf(value) !== -1;
      } else if (operator === "notContains") {
        return valueInContext.indexOf(value) === -1;
      } else if (operator === "startsWith") {
        return valueInContext.startsWith(value);
      } else if (operator === "endsWith") {
        return valueInContext.endsWith(value);
      } else if (operator === "semverEquals") {
        return compareVersions(valueInContext, value) === 0;
      } else if (operator === "semverNotEquals") {
        return compareVersions(valueInContext, value) !== 0;
      } else if (operator === "semverGreaterThan") {
        return compareVersions(valueInContext, value) === 1;
      } else if (operator === "semverGreaterThanOrEquals") {
        return compareVersions(valueInContext, value) >= 0;
      } else if (operator === "semverLessThan") {
        return compareVersions(valueInContext, value) === -1;
      } else if (operator === "semverLessThanOrEquals") {
        return compareVersions(valueInContext, value) <= 0;
      } else if (operator === "matches") {
        const regex = this.getRegex(value, regexFlags || "");
        regex.lastIndex = 0;
        return regex.test(valueInContext);
      } else if (operator === "notMatches") {
        const regex = this.getRegex(value, regexFlags || "");
        regex.lastIndex = 0;
        return !regex.test(valueInContext);
      }
    } else if (typeof sourceValue === "number" && typeof value === "number") {
      // numeric
      const valueInContext = sourceValue as number;

      if (operator === "greaterThan") {
        return valueInContext > value;
      } else if (operator === "greaterThanOrEquals") {
        return valueInContext >= value;
      } else if (operator === "lessThan") {
        return valueInContext < value;
      } else if (operator === "lessThanOrEquals") {
        return valueInContext <= value;
      }
    } else if (Array.isArray(sourceValue) && typeof value === "string") {
      // includes / notIncludes (where context value is an array)
      const valueInContext = sourceValue as string[];

      if (operator === "includes") {
        return valueInContext.indexOf(value) > -1;
      } else if (operator === "notIncludes") {
        return valueInContext.indexOf(value) === -1;
      }
    }

    return false;
  }

  private async _allAreMatched(
    conditions: Condition[] | Condition,
    inputs: Inputs,
  ): Promise<boolean> {
    if (typeof conditions === "string") {
      if (conditions === "*") {
        return true;
      }

      return false;
    }

    if (!conditions || typeof conditions !== "object") return false;

    if ("operator" in conditions) {
      try {
        return await this.isMatched(conditions, inputs);
      } catch (e) {
        this.logger.warn(e.message, {
          error: e,
          details: {
            condition: conditions,
          },
        });

        return false;
      }
    }

    if ("and" in conditions && Array.isArray(conditions.and)) {
      if (conditions.and.length === 0) return false;
      for (const c of conditions.and) {
        if (!(await this._allAreMatched(c, inputs))) {
          return false; // If any condition fails, return false
        }
      }
      return true; // All conditions passed
    }

    if ("or" in conditions && Array.isArray(conditions.or)) {
      for (const c of conditions.or) {
        if (await this._allAreMatched(c, inputs)) {
          return true; // If any condition passes, return true
        }
      }
      return false; // No conditions passed
    }

    if ("not" in conditions && Array.isArray(conditions.not)) {
      if (conditions.not.length === 0) return false;
      for (const c of conditions.not) {
        if (!(await this._allAreMatched(c, inputs))) {
          return true;
        }
      }
      return false;
    }

    if (Array.isArray(conditions)) {
      if (conditions.length === 0) return false;
      let result = true;
      for (const c of conditions) {
        if (!(await this._allAreMatched(c, inputs))) {
          result = false;
          break;
        }
      }

      return result;
    }

    return false;
  }

  async allAreMatched(conditions: Condition[] | Condition, inputs: Inputs): Promise<boolean> {
    const parsedConditions = this.parseIfStringified(conditions);

    const result = this._allAreMatched(parsedConditions, inputs);

    return result;
  }

  parseIfStringified(conditions: Condition | Condition[]): Condition | Condition[] {
    if (typeof conditions !== "string") {
      // already parsed
      return conditions;
    }

    if (conditions === "*") {
      // everyone
      return conditions;
    }

    try {
      return JSON.parse(conditions);
    } catch (e) {
      this.logger.error("Error parsing conditions", {
        error: e,
        details: {
          conditions,
        },
      });

      return conditions;
    }
  }
}
