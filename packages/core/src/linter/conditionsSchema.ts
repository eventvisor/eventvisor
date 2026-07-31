import * as z from "zod";

import { Dependencies } from "../dependencies";
import { getSourceBaseRefine, getSourceBaseSchema } from "./sourceSchema";

const semverPattern =
  /^[v^~<>=]*?(\d+)(?:\.([x*]|\d+)(?:\.([x*]|\d+)(?:\.([x*]|\d+))?(?:-([\da-z-]+(?:\.[\da-z-]+)*))?(?:\+[\da-z-]+(?:\.[\da-z-]+)*)?)?)?$/i;
const portableDatePattern =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/;

function getPortableRegexError(pattern: string, flags = "") {
  if (flags && (!/^[gims]+$/.test(flags) || new Set(flags).size !== flags.length)) {
    return "flags must contain unique characters from g, i, m, and s";
  }
  try {
    new RegExp(pattern, flags);
  } catch (error) {
    return `pattern must be valid: ${error instanceof Error ? error.message : String(error)}`;
  }
  if (/\(\?/.test(pattern)) {
    return "pattern must not use lookaround, named groups, noncapturing groups, atomic groups, or inline mode groups";
  }
  if (/\\(?:[1-9]|k<|k'|g<|g')/.test(pattern)) {
    return "pattern must not use backreferences";
  }
  if (/(?:[?*+]|\{\d+(?:,\d*)?\})\+/.test(pattern)) {
    return "pattern must not use possessive quantifiers";
  }
  return undefined;
}

export function getConditionsSchema(deps: Dependencies) {
  const sourceBase = getSourceBaseSchema(deps);

  const plainConditionSchema = z
    .object({
      ...sourceBase.shape,
      operator: z.enum([
        "equals",
        "notEquals",
        "exists",
        "notExists",

        // numeric
        "greaterThan",
        "greaterThanOrEquals",
        "lessThan",
        "lessThanOrEquals",

        // string
        "contains",
        "notContains",
        "startsWith",
        "endsWith",

        // semver (string)
        "semverEquals",
        "semverNotEquals",
        "semverGreaterThan",
        "semverGreaterThanOrEquals",
        "semverLessThan",
        "semverLessThanOrEquals",

        // date comparisons
        "before",
        "after",

        // array of strings
        "includes",
        "notIncludes",

        // regex
        "matches",
        "notMatches",

        // array of strings
        "in",
        "notIn",
      ]),
      value: z.any().optional(),
      regexFlags: z.string().optional(),
    })
    .refine(...getSourceBaseRefine())
    // @TODO: refine "value" type against each "operator"
    .refine(
      (data) => {
        if (data.operator === "exists" || data.operator === "notExists") {
          return data.value === undefined;
        }

        return data.value !== undefined;
      },
      { message: "Value is required for all operators except exists and notExists" },
    )
    .superRefine((data, ctx) => {
      const numeric = ["greaterThan", "greaterThanOrEquals", "lessThan", "lessThanOrEquals"];
      const strings = [
        "contains",
        "notContains",
        "startsWith",
        "endsWith",
        "semverEquals",
        "semverNotEquals",
        "semverGreaterThan",
        "semverGreaterThanOrEquals",
        "semverLessThan",
        "semverLessThanOrEquals",
        "before",
        "after",
        "matches",
        "notMatches",
      ];
      if (numeric.includes(data.operator) && typeof data.value !== "number") {
        ctx.addIssue({
          code: "custom",
          path: ["value"],
          message: `${data.operator} requires a number`,
        });
      }
      if (strings.includes(data.operator) && typeof data.value !== "string") {
        ctx.addIssue({
          code: "custom",
          path: ["value"],
          message: `${data.operator} requires a string`,
        });
      }
      if (["in", "notIn"].includes(data.operator)) {
        if (
          !Array.isArray(data.value) ||
          data.value.some(
            (value) => value !== null && !["string", "number", "boolean"].includes(typeof value),
          )
        ) {
          ctx.addIssue({
            code: "custom",
            path: ["value"],
            message: `${data.operator} requires an array of primitive values`,
          });
        }
      }
      if (["includes", "notIncludes"].includes(data.operator)) {
        if (data.value !== null && !["string", "number", "boolean"].includes(typeof data.value)) {
          ctx.addIssue({
            code: "custom",
            path: ["value"],
            message: `${data.operator} requires a primitive value`,
          });
        }
      }
      if (
        typeof data.regexFlags !== "undefined" &&
        !["matches", "notMatches"].includes(data.operator)
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["regexFlags"],
          message: "regexFlags is only valid with matches and notMatches",
        });
      }
      if (["matches", "notMatches"].includes(data.operator) && typeof data.value === "string") {
        const error = getPortableRegexError(data.value, data.regexFlags || "");
        if (error) {
          ctx.addIssue({
            code: "custom",
            path: ["value"],
            message: `Regular expression ${error} in the cross-SDK subset`,
          });
        }
      }
      if (["before", "after"].includes(data.operator) && typeof data.value === "string") {
        const date = new Date(data.value);
        if (!portableDatePattern.test(data.value) || Number.isNaN(date.getTime())) {
          ctx.addIssue({
            code: "custom",
            path: ["value"],
            message: `${data.operator} requires an ISO 8601 date and time with a timezone`,
          });
        }
      }
      if (data.operator.startsWith("semver") && typeof data.value === "string") {
        if (!semverPattern.test(data.value)) {
          ctx.addIssue({
            code: "custom",
            path: ["value"],
            message: `${data.operator} requires a valid semantic version`,
          });
        }
      }
    });

  const stringConditionSchema = z.string().superRefine((value, ctx) => {
    if (value === "*") return;
    try {
      const parsed = JSON.parse(value);
      if (conditionSchema.safeParse(parsed).success) return;
    } catch {
      // Report one consistent error below.
    }
    ctx.addIssue({ code: "custom", message: 'Expected "*" or a stringified condition' });
  });

  const conditionSchema: z.ZodTypeAny = z.lazy(() =>
    z.union([
      plainConditionSchema,
      z.object({ and: z.array(conditionSchema).min(1) }).strict(),
      z.object({ or: z.array(conditionSchema).min(1) }).strict(),
      z.object({ not: z.array(conditionSchema).min(1) }).strict(),
      stringConditionSchema,
    ]),
  );

  return z.union([conditionSchema, z.array(conditionSchema).min(1)]);
}
