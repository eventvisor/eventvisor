import * as z from "zod";
import { Dependencies } from "../dependencies";

import { JSONZodSchema } from "./jsonSchema";
import { getTagsSchema } from "./tagsSchema";
import { getConditionsSchema } from "./conditionsSchema";
import { getSampleSchema } from "./sampleSchema";
import { getTransformsSchema } from "./transformsSchema";

export function getDestinationSchema(deps: Dependencies) {
  return z
    .object({
      ...JSONZodSchema.shape,

      archived: z.boolean().optional(),
      description: z.string(),
      tags: getTagsSchema(deps),

      transport: z.string(),
      conditions: getConditionsSchema(deps).optional(),
      sample: getSampleSchema(deps).optional(),
      transforms: getTransformsSchema(deps).optional(),
    })
    .strict();
}
