import * as z from "zod";

import { Dependencies } from "../dependencies";
import { getConditionsSchema } from "./conditionsSchema";
import { getTagsSchema } from "./tagsSchema";
import { getTransformsSchema } from "./transformsSchema";
import { getPersistSchema } from "./persistSchema";

export function getEffectSchema(deps: Dependencies) {
  const effectOnType = z.enum(["event_tracked", "attribute_set"]);
  const effectOnRecord = z
    .object({
      event_tracked: z.array(z.string()).optional(),
      attribute_set: z.array(z.string()).optional(),
    })
    .refine(
      (data) => {
        return Object.values(data).some((value) => value !== undefined);
      },
      {
        message: "Either event_tracked or attribute_set must be provided",
        path: ["event_tracked", "attribute_set"],
      },
    );
  const effectOn = z.union([z.array(effectOnType), effectOnRecord]);

  const step = z.object({
    description: z.string().optional(),
    handler: z.string().optional(),
    conditions: getConditionsSchema(deps).optional(),
    params: z.record(z.string(), z.any()).optional(),
    transforms: getTransformsSchema(deps).optional(),
    continueOnError: z.boolean().optional(),
  });

  return z
    .object({
      archived: z.boolean().optional(),
      description: z.string(),
      tags: getTagsSchema(deps),

      on: effectOn,
      state: z.any().optional(),
      conditions: getConditionsSchema(deps).optional(),
      steps: z.array(step),
      persist: getPersistSchema(deps).optional(),
    })
    .strict();
}
