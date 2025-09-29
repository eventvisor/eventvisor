import * as z from "zod";
import { Dependencies } from "../dependencies";

import { JSONZodSchema } from "./jsonSchema";
import { getTagsSchema } from "./tagsSchema";
import { getTransformsSchema } from "./transformsSchema";
import { getPersistSchema } from "./persistSchema";

export function getAttributeSchema(deps: Dependencies) {
  return z
    .object({
      ...JSONZodSchema.shape,

      archived: z.boolean().optional(),
      deprecated: z.boolean().optional(),
      description: z.string(),
      tags: getTagsSchema(deps),

      transforms: getTransformsSchema(deps).optional(),
      persist: getPersistSchema(deps).optional(),
    })
    .strict();
}
