import type { EntityType } from "@eventvisor/types";
import type { Plugin } from "../cli";
import { getSelectedProjectExecution } from "../sets";
import { CLI_FORMAT_BOLD } from "../tester/cliFormat";

export const infoPlugin: Plugin = {
  command: "info <entityType> <key>",
  description: "show one project entity",
  options: {
    json: { type: "boolean", description: "print compact JSON" },
    pretty: { type: "boolean", description: "pretty print JSON" },
    set: { type: "string", description: "select a project set" },
  },
  handler: async ({ projectConfig, datasource, parsed }) => {
    const { datasource: selectedDatasource } = await getSelectedProjectExecution(
      projectConfig,
      datasource,
      parsed.set,
    );
    const type = parsed.entityType as EntityType;
    const method = `read${type.charAt(0).toUpperCase()}${type.slice(1)}`;
    if (typeof selectedDatasource[method] !== "function")
      throw new Error(`Unknown entity type "${type}".`);
    const entity = await selectedDatasource[method](parsed.key);
    if (parsed.json) console.log(JSON.stringify(entity, null, parsed.pretty ? 2 : undefined));
    else {
      console.log("");
      console.log(
        CLI_FORMAT_BOLD,
        `${type.charAt(0).toUpperCase()}${type.slice(1)} "${parsed.key}"`,
      );
      console.log("");
      console.log(JSON.stringify(entity, null, 2));
      console.log("");
    }
  },
  examples: [{ command: "info event page_view", description: "show an event definition" }],
};
