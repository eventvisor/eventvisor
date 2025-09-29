import * as z from "zod";
import { Dependencies } from "../dependencies";

export function getTagsSchema(deps: Dependencies) {
  const { projectConfig } = deps;

  return z.array(
    z.string().refine((tag) => projectConfig.tags.indexOf(tag) > -1, {
      message: `Tag must be one of: ${projectConfig.tags.join(", ")}`,
    }),
  );
}
