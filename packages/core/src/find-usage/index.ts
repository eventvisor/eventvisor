import type { EntityType } from "@eventvisor/types";
import type { Plugin } from "../cli";
import { getSelectedProjectExecution } from "../sets";
import { CLI_COLOR_CYAN, CLI_FORMAT_BOLD, CLI_FORMAT_GREEN, colorize } from "../tester/cliFormat";
import { containsExactString } from "../utils/references";

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
      "schema",
      "target",
      "test",
    ] as EntityType[]) {
      const list = `list${type.charAt(0).toUpperCase()}${type.slice(1)}s`;
      const read = `read${type.charAt(0).toUpperCase()}${type.slice(1)}`;
      for (const key of await selectedDatasource[list]()) {
        if (type === parsed.entityType && key === parsed.key) continue;
        const content = await selectedDatasource[read](key);
        if (containsExactString(content, parsed.key)) usages.push({ entityType: type, key });
      }
    }
    if (parsed.json) console.log(JSON.stringify(usages, null, parsed.pretty ? 2 : undefined));
    else {
      console.log("");
      console.log(CLI_FORMAT_BOLD, `Usage of ${parsed.entityType} "${parsed.key}"`);
      console.log("");
      if (usages.length === 0) console.log(CLI_FORMAT_GREEN, "No references found.");
      else
        usages.forEach((usage) =>
          console.log(`  ${colorize("•", CLI_COLOR_CYAN)} ${usage.entityType}: ${usage.key}`),
        );
      console.log("");
    }
  },
  examples: [{ command: "find-usage attribute userId", description: "find attribute references" }],
};
