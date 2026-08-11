import * as z from "zod";

import { Dependencies } from "../dependencies";
import { getSourceBaseSchema } from "./sourceSchema";
import { getConditionsSchema } from "./conditionsSchema";
import { getSafePathSegments } from "@eventvisor/sdk/portable";

const sourceKeys = ["source", "attribute", "state", "effect", "payload", "lookup"] as const;

export function getTransformsSchema(deps: Dependencies) {
  const schema = z
    .object({
      ...getSourceBaseSchema(deps).shape,
      type: z.enum([
        "increment",
        "decrement",
        "concat",
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
      const selectedSources = sourceKeys.filter((key) => typeof transform[key] !== "undefined");
      const hasSource = selectedSources.length > 0;
      if (selectedSources.length > 1) {
        ctx.addIssue({ code: "custom", message: "A transform can use at most one source" });
      }
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
      if (
        ["set", "spread", "append"].includes(transform.type) &&
        hasSource &&
        "value" in transform
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["value"],
          message: `${transform.type} cannot use both a source and value`,
        });
      }
      if (
        ["increment", "decrement"].includes(transform.type) &&
        typeof transform.value !== "undefined" &&
        typeof transform.value !== "number"
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["value"],
          message: `${transform.type} value must be a number`,
        });
      }
      if (transform.separator && transform.type !== "concat") {
        ctx.addIssue({
          code: "custom",
          path: ["separator"],
          message: "separator is only valid for concat",
        });
      }
      if (transform.target && !getSafePathSegments(transform.target)) {
        ctx.addIssue({
          code: "custom",
          path: ["target"],
          message: "Target path contains an unsafe segment",
        });
      }
      if (transform.targetMap) {
        const maps = Array.isArray(transform.targetMap)
          ? transform.targetMap
          : [transform.targetMap];
        for (const targetMap of maps) {
          for (const [from, to] of Object.entries(targetMap)) {
            if (!getSafePathSegments(from) || !getSafePathSegments(to)) {
              ctx.addIssue({
                code: "custom",
                path: ["targetMap"],
                message: "Rename paths must not contain unsafe segments",
              });
            }
          }
        }
      }

      const allowedByType: Record<string, string[]> = {
        increment: ["target", "value"],
        decrement: ["target", "value"],
        concat: ["target", "separator"],
        remove: ["target"],
        rename: ["targetMap"],
        set: ["target", "value"],
        trim: ["target"],
        toInteger: ["target"],
        toDouble: ["target"],
        toString: ["target"],
        toBoolean: ["target"],
        spread: ["target", "value"],
        append: ["target", "value"],
      };
      const common = new Set([
        "type",
        "conditions",
        ...sourceKeys,
        ...allowedByType[transform.type],
      ]);
      for (const key of Object.keys(transform)) {
        if (!common.has(key)) {
          ctx.addIssue({
            code: "custom",
            path: [key],
            message: `${key} is not valid for ${transform.type}`,
          });
        }
      }
    });

  return z.array(schema);
}
