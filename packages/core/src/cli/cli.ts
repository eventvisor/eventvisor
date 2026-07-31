import type { ProjectConfig } from "../config";
import { Datasource } from "../datasource";

import { commonPlugins, nonProjectPlugins, projectBasedPlugins } from "./plugins";
import { CLI_FORMAT_RED } from "../tester/cliFormat";

export interface ParsedOptions {
  _: string[];
  [key: string]: any;
}

export interface PluginHandlerOptions {
  rootDirectoryPath: string;
  projectConfig: ProjectConfig;
  datasource: Datasource;
  parsed: ParsedOptions;
}

export interface Plugin {
  command: string; // command declaration, optionally with yargs positionals
  handler: (options: PluginHandlerOptions) => Promise<void | boolean>;
  examples: {
    command: string; // full command usage
    description: string;
  }[];
  options?: Record<
    string,
    {
      type: "string" | "boolean" | "number" | "array";
      description?: string;
      alias?: string;
      demandOption?: boolean;
    }
  >;
}

/**
 * Defines a type-safe Eventvisor CLI plugin without changing it at runtime.
 */
export function definePlugin(plugin: Plugin): Plugin {
  return plugin;
}

export interface RunnerOptions {
  rootDirectoryPath: string;

  // optional because CLI can be used without a project
  projectConfig?: ProjectConfig;
  datasource?: Datasource;
}

export async function runCLI(runnerOptions: RunnerOptions): Promise<number> {
  const yargs = require("yargs");

  let y = yargs(process.argv.slice(2))
    .usage("Usage: <command> [options]")
    .strictCommands()
    .strictOptions()
    .exitProcess(false);
  const registeredSubcommands: string[] = [];

  const { rootDirectoryPath, projectConfig, datasource } = runnerOptions;

  let exitCode = 0;

  function registerPlugin(plugin: Plugin) {
    const subcommand = plugin.command.split(" ")[0];

    if (registeredSubcommands.includes(subcommand)) {
      console.warn(`Plugin "${subcommand}" already registered. Skipping.`);
      return;
    }

    y = y.command({
      command: plugin.command,
      builder: plugin.options || {},
      handler: async function (parsed: ParsedOptions) {
        try {
          const result = await plugin.handler({
            rootDirectoryPath,
            projectConfig,
            datasource,
            parsed,
          } as PluginHandlerOptions);

          if (result === false) {
            exitCode = 1;
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          console.error(CLI_FORMAT_RED, `Error: ${message}`);
          exitCode = 1;
        }
      },
    });

    for (const example of plugin.examples) {
      y = y.example(`$0 ${example.command}`, example.description);
    }

    registeredSubcommands.push(subcommand);
  }

  // non project-based plugins
  if (!projectConfig) {
    for (const plugin of nonProjectPlugins) {
      registerPlugin(plugin);
    }
  }

  // project-based plugins
  if (projectConfig) {
    for (const plugin of [...projectBasedPlugins, ...(projectConfig.plugins || [])]) {
      registerPlugin(plugin);
    }
  }

  // common plugins
  for (const plugin of commonPlugins) {
    registerPlugin(plugin);
  }

  if (process.argv.slice(2).length === 0) {
    y.showHelp();
    return exitCode;
  }

  try {
    await y.parseAsync();
  } catch (error) {
    console.error(
      CLI_FORMAT_RED,
      `Error: ${error instanceof Error ? error.message : String(error)}`,
    );
    return 1;
  }
  return exitCode;
}
