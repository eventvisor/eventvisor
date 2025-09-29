import * as z from "zod";
import { Dependencies } from "../dependencies";

// eslint-disable-next-line
export function getTestSchema(deps: Dependencies) {
  return z.object({
    archived: z.boolean().optional(),
  });
}
