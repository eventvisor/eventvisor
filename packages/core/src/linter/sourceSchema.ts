import * as z from "zod";
import { Dependencies } from "../dependencies";
import { getSafePathSegments } from "@eventvisor/sdk/portable";

// eslint-disable-next-line
export function getSourceBaseSchema(deps: Dependencies) {
  const source = z.string().refine((value) => getSafePathSegments(value) !== null, {
    message: "Source paths must not be empty or contain __proto__, prototype, or constructor",
  });
  const sourceUnion = z.union([source, z.array(source).min(1)]);

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

type SourceBase = z.infer<ReturnType<typeof getSourceBaseSchema>>;

export function getSourceBaseRefine(): [
  (data: SourceBase) => boolean,
  { message: string; path: PropertyKey[] },
] {
  return [
    (data) => {
      return needOneOf.filter((key) => typeof data[key] !== "undefined").length === 1;
    },
    {
      message: "Exactly one source is required",
      path: [],
    },
  ];
}
