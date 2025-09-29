import * as z from "zod";

import { Dependencies } from "../dependencies";
import { getSourceBaseSchema } from "./sourceSchema";

export function getTransformsSchema(deps: Dependencies) {
  return z.array(
    z.object({
      // .refine() is intentionally not called here for now, since not all transforms need sources
      // @TODO: make it stricter based on transform types
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
      targetMap: z.record(z.string(), z.any()).optional(),
      value: z.any().optional(),

      // transform type specific params
      separator: z.string().optional(),
    }), // do NOT call .strict() here
  );
}
