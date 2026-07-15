import type { Value } from "@eventvisor/types";
import { buildDatafile } from "../builder";
import type { BuildDatafileOptions } from "../builder";
import type { Plugin } from "../cli";
import { createCliInstance } from "../utils";
import { getSelectedProjectExecution } from "../sets";

function parseValue(input: unknown, fallback: Value): Value {
  if (typeof input !== "string") return fallback;
  try {
    return JSON.parse(input);
  } catch {
    throw new Error("Values must be valid JSON.");
  }
}

export const simulatePlugin: Plugin = {
  command: "simulate <event>",
  options: {
    value: { type: "string", description: "event payload as JSON" },
    attributes: { type: "string", description: "attributes as JSON" },
    tag: { type: "string" },
    target: { type: "string" },
    set: { type: "string" },
    json: { type: "boolean" },
  },
  handler: async ({ rootDirectoryPath, projectConfig, datasource, parsed }) => {
    const execution = await getSelectedProjectExecution(projectConfig, datasource, parsed.set);
    const deps = {
      rootDirectoryPath,
      projectConfig: execution.projectConfig,
      datasource: execution.datasource,
      options: parsed,
    };
    const instance = createCliInstance(await buildDatafile(deps, parsed as BuildDatafileOptions));
    try {
      const attributes = parseValue(parsed.attributes, {}) as Record<string, Value>;
      for (const [name, value] of Object.entries(attributes))
        await instance.setAttribute(name, value);
      const result = await instance.track(parsed.event, parseValue(parsed.value, {}));
      console.log(parsed.json ? JSON.stringify(result) : JSON.stringify(result, null, 2));
    } finally {
      await instance.close();
    }
  },
  examples: [{ command: "simulate page_view --value='{}'", description: "simulate an event" }],
};
