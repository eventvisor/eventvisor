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
    );

  const andConditionSchema = z.object({
    and: z.array(plainConditionSchema),
  });

  const orConditionSchema = z.object({
    or: z.array(plainConditionSchema),
  });

  const notConditionSchema = z.object({
    not: z.array(plainConditionSchema),
  });

  const conditionSchema = z.union([
    plainConditionSchema,
    andConditionSchema,
    orConditionSchema,
    notConditionSchema,
  ]);

  return z.union([conditionSchema, z.array(conditionSchema)]);
}
