import * as z from "zod";
import { Dependencies } from "../dependencies";

import { JSONZodSchema } from "./jsonSchema";
import { getTagsSchema } from "./tagsSchema";
import { getConditionsSchema } from "./conditionsSchema";
import { getTransformsSchema } from "./transformsSchema";
import { getSampleSchema } from "./sampleSchema";

export function getEventSchema(deps: Dependencies) {
  return z
    .object({
      ...JSONZodSchema.shape,

      archived: z.boolean().optional(),
      deprecated: z.boolean().optional(),
      description: z.string(),
      tags: getTagsSchema(deps),

      level: z.enum(["fatal", "error", "warning", "log", "info", "debug"]).optional(),
      requiredAttributes: z.array(z.string()).optional(),
      conditions: getConditionsSchema(deps).optional(),
      sample: getSampleSchema(deps).optional(),
      transforms: getTransformsSchema(deps).optional(),
      destinations: z
        .record(
          z.string(), // @TODO: get real destination names here
          z.union([
            z.boolean(),
            z.object({
              conditions: getConditionsSchema(deps).optional(),
              sample: getSampleSchema(deps).optional(),
              transforms: getTransformsSchema(deps).optional(),
            }),
          ]),
        )
        .optional(),
    })
    .strict();
}
