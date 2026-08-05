import type { EntityType } from "@eventvisor/types";
import type { Plugin } from "../cli";
import { getSelectedProjectExecution } from "../sets";
import { CLI_COLOR_CYAN, CLI_FORMAT_BOLD, CLI_FORMAT_GREEN, colorize } from "../tester/cliFormat";
import { buildDependencyGraph, entityId, invertDependencyGraph } from "../utils/dependencyGraph";

export const findUsagePlugin: Plugin = {
  command: "find-usage [entityType] [key]",
  description: "find entity references and unused definitions",
  options: {
    json: { type: "boolean", description: "print JSON" },
    pretty: { type: "boolean", description: "pretty print JSON" },
    set: { type: "string", description: "select a project set" },
    unusedAttributes: { type: "boolean", description: "list attributes with no references" },
    unusedSchemas: { type: "boolean", description: "list schemas with no references" },
    unusedDestinations: { type: "boolean", description: "list destinations with no references" },
  },
  handler: async ({ projectConfig, datasource, parsed }) => {
    const { datasource: selectedDatasource } = await getSelectedProjectExecution(
      projectConfig,
      datasource,
      parsed.set,
    );
    const inverse = invertDependencyGraph(await buildDependencyGraph(selectedDatasource));
    const unusedTypes = [
      parsed.unusedAttributes && "attribute",
      parsed.unusedSchemas && "schema",
      parsed.unusedDestinations && "destination",
    ].filter(Boolean) as EntityType[];
    if (unusedTypes.length) {
      const unused = Object.entries(inverse)
        .filter(
          ([id, references]) =>
            unusedTypes.some((type) => id.startsWith(`${type}:`)) && references.length === 0,
        )
        .map(([id]) => {
          const separator = id.indexOf(":");
          return { entityType: id.slice(0, separator) as EntityType, key: id.slice(separator + 1) };
        });
      if (parsed.json) console.log(JSON.stringify(unused, null, parsed.pretty ? 2 : undefined));
      else {
        console.log("");
        console.log(CLI_FORMAT_BOLD, "Unused entities");
        console.log("");
        if (!unused.length) console.log(CLI_FORMAT_GREEN, "No unused entities found.");
        unused.forEach((entry) =>
          console.log(`  ${colorize("•", CLI_COLOR_CYAN)} ${entry.entityType}: ${entry.key}`),
        );
        console.log("");
      }
      return;
    }
    if (!parsed.entityType || !parsed.key) {
      throw new Error("Pass an entity type and key, or use an --unused* option.");
    }
    const usages = (inverse[entityId(parsed.entityType as EntityType, parsed.key)] || []).map(
      ({ type, key }) => ({ entityType: type, key }),
    );
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
