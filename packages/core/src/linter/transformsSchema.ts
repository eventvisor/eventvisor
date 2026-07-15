import * as z from "zod";

import { Dependencies } from "../dependencies";
import { getSourceBaseSchema } from "./sourceSchema";
import { getConditionsSchema } from "./conditionsSchema";

export function getTransformsSchema(deps: Dependencies) {
  const schema = z
    .object({
      ...getSourceBaseSchema(deps).shape,
      type: z.enum([
        "increment",
        "decrement",
        "concat", // @TODO: rename to `join`?
        "remove",
        "rename",
        "set",
        "trim",
        "toInteger",
        "toDouble",
        "toString",
        "toBoolean",
        "spread",
        "append",
      ]),
      target: z.string().optional(),
      targetMap: z
        .union([z.record(z.string(), z.string()), z.array(z.record(z.string(), z.string())).min(1)])
        .optional(),
      value: z.any().optional(),
      separator: z.string().optional(),
      conditions: getConditionsSchema(deps).optional(),
    })
    .strict()
    .superRefine((transform, ctx) => {
      const hasSource = ["source", "attribute", "state", "effect", "payload", "lookup"].some(
        (key) => typeof transform[key] !== "undefined",
      );
      const requiresTarget = [
        "concat",
        "remove",
        "trim",
        "toInteger",
        "toDouble",
        "toString",
        "toBoolean",
      ].includes(transform.type);
      if (requiresTarget && !transform.target) {
        ctx.addIssue({
          code: "custom",
          path: ["target"],
          message: `Transform ${transform.type} requires target`,
        });
      }
      if (transform.type === "rename" && !transform.targetMap) {
        ctx.addIssue({
          code: "custom",
          path: ["targetMap"],
          message: "Transform rename requires targetMap",
        });
      }
      if (
        ["spread", "append"].includes(transform.type) &&
        !hasSource &&
        typeof transform.value === "undefined"
      ) {
        ctx.addIssue({
          code: "custom",
          message: `Transform ${transform.type} requires a source or value`,
        });
      }
      if (transform.type === "set" && !hasSource && typeof transform.value === "undefined") {
        ctx.addIssue({ code: "custom", message: "Transform set requires a source or value" });
      }
      if (transform.separator && transform.type !== "concat") {
        ctx.addIssue({
          code: "custom",
          path: ["separator"],
          message: "separator is only valid for concat",
        });
      }
    });

  return z.array(schema);
}
