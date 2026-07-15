import * as z from "zod";

import { Dependencies } from "../dependencies";
import { getSourceBaseRefine, getSourceBaseSchema } from "./sourceSchema";

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
        "includes",
        "notIncludes",
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
      if (["in", "notIn"].includes(data.operator) && !Array.isArray(data.value)) {
        ctx.addIssue({
          code: "custom",
          path: ["value"],
          message: `${data.operator} requires an array`,
        });
      }
      if (data.regexFlags && !["matches", "notMatches"].includes(data.operator)) {
        ctx.addIssue({
          code: "custom",
          path: ["regexFlags"],
          message: "regexFlags is only valid with matches and notMatches",
        });
      }
      if (["matches", "notMatches"].includes(data.operator) && typeof data.value === "string") {
        try {
          new RegExp(data.value, data.regexFlags || "");
        } catch {
          ctx.addIssue({ code: "custom", path: ["value"], message: "Invalid regular expression" });
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
