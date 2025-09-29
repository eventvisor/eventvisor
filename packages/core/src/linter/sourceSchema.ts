import * as z from "zod";
import { Dependencies } from "../dependencies";

// eslint-disable-next-line
export function getSourceBaseSchema(deps: Dependencies) {
  const source = z.string();
  const sourceUnion = z.union([source, z.array(source)]);

  // need .shape API from Zod, so cannot do .union() here
  return z.object({
    // one of them is required
    source: sourceUnion.optional(),
    attribute: sourceUnion.optional(),
    state: sourceUnion.optional(),
    effect: sourceUnion.optional(),
    payload: sourceUnion.optional(),
    lookup: sourceUnion.optional(),
  });
}

const needOneOf = ["source", "attribute", "state", "effect", "payload", "lookup"];

// @TODO: make return type better
export function getSourceBaseRefine(): [any, any] {
  return [
    (data) => {
      const keys = Object.keys(data);

      for (const key of keys) {
        if (needOneOf.includes(key)) {
          return true;
        }
      }

      return false;
    },
    {
      message: "At least one source is required",
      path: [],
    },
  ];
}
