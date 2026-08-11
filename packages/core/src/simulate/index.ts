import type { Value } from "@eventvisor/types";
import { buildSelectedDatafile } from "../builder";
import type { BuildSelectedDatafileOptions } from "../builder";
import type { Plugin } from "../cli";
import { createCliInstance, parseJsonOption } from "../utils";
import { getSelectedProjectExecution } from "../sets";
import { CLI_COLOR_CYAN, CLI_FORMAT_BOLD, CLI_FORMAT_GREEN, colorize } from "../tester/cliFormat";

export function parseAttributesOption(input: unknown): Record<string, Value> {
  const attributes = parseJsonOption<unknown>(input, {}, "Attributes");
  if (!attributes || typeof attributes !== "object" || Array.isArray(attributes)) {
    throw new Error("Attributes must be a JSON object.");
  }
  return attributes as Record<string, Value>;
}

export const simulatePlugin: Plugin = {
  command: "simulate <event>",
  description: "simulate one event through the runtime pipeline",
  options: {
    value: { type: "string", description: "event payload as JSON" },
    attributes: { type: "string", description: "attributes as JSON" },
    tag: { type: "array", description: "include one or more tags" },
    target: { type: "array", description: "include one or more Targets" },
    set: { type: "string", description: "select a project Set" },
    json: { type: "boolean", description: "print JSON output" },
  },
  handler: async ({ rootDirectoryPath, projectConfig, datasource, parsed }) => {
    const execution = await getSelectedProjectExecution(projectConfig, datasource, parsed.set);
    const deps = {
      rootDirectoryPath,
      projectConfig: execution.projectConfig,
      datasource: execution.datasource,
      options: parsed,
    };
    const instance = createCliInstance(
      await buildSelectedDatafile(deps, parsed as BuildSelectedDatafileOptions),
    );
    try {
      const attributes = parseAttributesOption(parsed.attributes);
      for (const [name, value] of Object.entries(attributes))
        await instance.setAttribute(name, value);
      const result = await instance.track(
        parsed.event,
        parseJsonOption<Value>(parsed.value, {}, "Event value"),
      );
      if (parsed.json) console.log(JSON.stringify(result));
      else {
        console.log("");
        console.log(CLI_FORMAT_BOLD, "Simulating Eventvisor event");
        console.log(`  ${colorize("Event", CLI_COLOR_CYAN)}: ${parsed.event}`);
        console.log("");
        console.log(CLI_FORMAT_GREEN, "Simulation complete");
        console.log(JSON.stringify(result, null, 2));
        console.log("");
      }
    } finally {
      await instance.close();
    }
  },
  examples: [{ command: "simulate page_view --value='{}'", description: "simulate an event" }],
};
