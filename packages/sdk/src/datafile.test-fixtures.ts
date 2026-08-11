import type { Attribute, DatafileContent, Effect } from "@eventvisor/types";
import { getComplexPersists, type InstanceDataProvider } from "./datafile.js";

export function createTestDataProvider(datafile: DatafileContent): InstanceDataProvider {
  const regexCache: Record<string, RegExp> = {};
  return {
    getSchemaVersion: () => datafile.schemaVersion,
    getRevision: () => datafile.revision,
    getAttribute: (name) => datafile.attributes[name],
    getAttributeNames: () => Object.keys(datafile.attributes),
    getEvent: (name) => datafile.events[name],
    getDestination: (name) => datafile.destinations[name],
    getDestinationNames: () => Object.keys(datafile.destinations),
    getEffect: (name) => datafile.effects[name],
    getEffectNames: () => Object.keys(datafile.effects),
    getRegex: (pattern, flags = "") => {
      const key = `${pattern}-${flags}`;
      return regexCache[key] || (regexCache[key] = new RegExp(pattern, flags));
    },
    getPersists: (schema: Attribute | Effect) =>
      schema.persist ? getComplexPersists(schema.persist) : null,
  };
}
