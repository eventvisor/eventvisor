import * as z from "zod";

import { Dependencies } from "../dependencies";
import { getConditionsSchema } from "./conditionsSchema";

export function getPersistSchema(deps: Dependencies) {
  const conditionsSchema = getConditionsSchema(deps);

  const simplePersist = z.string();

  const complexPersist = z.object({
    storage: z.string(),
    conditions: conditionsSchema.optional(),
  });

  return z.union([
    simplePersist,
    complexPersist,
    z.array(z.union([simplePersist, complexPersist])),
  ]);
}
