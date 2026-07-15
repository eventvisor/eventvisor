import type { EntityType } from "@eventvisor/types";
import type { Plugin } from "../cli";
import { getSelectedProjectExecution } from "../sets";

export const infoPlugin: Plugin = {
  command: "info <entityType> <key>",
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
    const pretty = parsed.pretty ?? !parsed.json;
    console.log(JSON.stringify(entity, null, pretty ? 2 : undefined));
  },
  examples: [{ command: "info event page_view", description: "show an event definition" }],
};
