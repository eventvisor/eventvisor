import * as z from "zod";

import { Dependencies } from "../dependencies";
import { getSourceBaseSchema, getSourceBaseRefine } from "./sourceSchema";
import { getConditionsSchema } from "./conditionsSchema";

export function getSampleSchema(deps: Dependencies) {
  const sampleByString = z.string();
  const sampleBySource = getSourceBaseSchema(deps).refine(...getSourceBaseRefine());

  const sampleBySingle = z.union([sampleByString, sampleBySource]);
  const sampleByMultiple = z.array(sampleBySingle);
  const sampleByOr = z.object({ or: sampleByMultiple });

  const sampleBy = z.union([sampleBySingle, sampleByMultiple, sampleByOr]);

  return z
    .object({
      by: sampleBy,
      conditions: getConditionsSchema(deps).optional(),

      // one of them below is required
      percentage: z.number().min(0).max(100).optional(),
      range: z.array(z.number().min(0).max(100)).min(2).max(2).optional(),
    })
    .refine(
      (data) => {
        // both missing
        if (data.percentage === undefined && data.range === undefined) {
          return false;
        }

        // both provided
        if (data.percentage !== undefined && data.range !== undefined) {
          return false;
        }

        return true;
      },
      {
        message: "Either `percentage` or `range` must be provided",
        path: [],
      },
    );
}
