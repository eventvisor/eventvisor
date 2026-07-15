import type { EntityType } from "@eventvisor/types";
import type { Plugin } from "../cli";
import { getSelectedProjectExecution } from "../sets";

export const findUsagePlugin: Plugin = {
  command: "find-usage <entityType> <key>",
  options: {
    json: { type: "boolean", description: "print JSON" },
    pretty: { type: "boolean", description: "pretty print JSON" },
    set: { type: "string", description: "select a project set" },
  },
  handler: async ({ projectConfig, datasource, parsed }) => {
    const { datasource: selectedDatasource } = await getSelectedProjectExecution(
      projectConfig,
      datasource,
      parsed.set,
    );
    const usages: { entityType: EntityType; key: string }[] = [];
    for (const type of [
      "event",
      "attribute",
      "destination",
      "effect",
      "target",
      "test",
    ] as EntityType[]) {
      const list = `list${type.charAt(0).toUpperCase()}${type.slice(1)}s`;
      const read = `read${type.charAt(0).toUpperCase()}${type.slice(1)}`;
      for (const key of await selectedDatasource[list]()) {
        if (type === parsed.entityType && key === parsed.key) continue;
        const content = await selectedDatasource[read](key);
        if (JSON.stringify(content).includes(JSON.stringify(parsed.key)))
          usages.push({ entityType: type, key });
      }
    }
    if (parsed.json) console.log(JSON.stringify(usages, null, parsed.pretty ? 2 : undefined));
    else usages.forEach((usage) => console.log(`${usage.entityType}: ${usage.key}`));
  },
  examples: [{ command: "find-usage attribute userId", description: "find attribute references" }],
};
