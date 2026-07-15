import type { EntityType } from "@eventvisor/types";
import type { Plugin } from "../cli";
import type { Datasource } from "../datasource";
import { getSelectedProjectExecution } from "../sets";

const supportedTypes = ["event", "attribute", "destination", "effect", "target", "test"] as const;

export async function listEntities(datasource: Datasource, type: EntityType, keyPattern?: string) {
  const method = `list${type.charAt(0).toUpperCase()}${type.slice(1)}s`;
  const keys = await datasource[method]();
  if (!keyPattern) return keys;
  const pattern = new RegExp(keyPattern, "i");
  return keys.filter((key) => pattern.test(key));
}

export const listPlugin: Plugin = {
  command: "list <entityType>",
  options: {
    keyPattern: { type: "string", description: "filter entity keys" },
    json: { type: "boolean", description: "print JSON" },
    pretty: { type: "boolean", description: "pretty print JSON" },
    set: { type: "string", description: "select a project set" },
  },
  handler: async ({ projectConfig, datasource, parsed }) => {
    const type = parsed.entityType as EntityType;
    if (!supportedTypes.includes(type as any)) {
      throw new Error(`Unknown entity type "${type}". Use: ${supportedTypes.join(", ")}.`);
    }
    const execution = await getSelectedProjectExecution(projectConfig, datasource, parsed.set);
    const keys = await listEntities(execution.datasource, type, parsed.keyPattern);
    if (parsed.json) console.log(JSON.stringify(keys, null, parsed.pretty ? 2 : undefined));
    else keys.forEach((key) => console.log(key));
  },
  examples: [{ command: "list event", description: "list event keys" }],
};
