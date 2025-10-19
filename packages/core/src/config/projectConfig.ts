import * as path from "path";

import { Parser, parsers } from "./parsers";
import { FilesystemAdapter } from "../datasource/filesystemAdapter";
import type { Plugin } from "../cli";

export const EVENTS_DIRECTORY_NAME = "events";
export const ATTRIBUTES_DIRECTORY_NAME = "attributes";
export const DESTINATIONS_DIRECTORY_NAME = "destinations";
export const STATES_DIRECTORY_NAME = "states";
export const EFFECTS_DIRECTORY_NAME = "effects";
export const TESTS_DIRECTORY_NAME = "tests";
export const SYSTEM_DIRECTORY_NAME = ".eventvisor";
export const DATAFILES_DIRECTORY_NAME = "datafiles";
export const DATAFILE_NAME_PATTERN = "eventvisor-%s.json";
export const CATALOG_EXPORT_DIRECTORY_NAME = "out";

export const CONFIG_MODULE_NAME = "eventvisor.config.js";
export const ROOT_DIR_PLACEHOLDER = "<rootDir>";

export const DEFAULT_PRETTY_DATAFILE = false;

export const DEFAULT_TAGS = ["all"];
export const DEFAULT_PARSER: Parser = "yml";

export const SCHEMA_VERSION = "1"; // default schema version

export interface ProjectConfig {
  eventsDirectoryPath: string;
  attributesDirectoryPath: string;
  destinationsDirectoryPath: string;
  statesDirectoryPath: string;
  effectsDirectoryPath: string;
  testsDirectoryPath: string;
  datafilesDirectoryPath: string;
  systemDirectoryPath: string;
  catalogExportDirectoryPath: string;
  datafileNamePattern: string;

  tags: string[];

  adapter: any; // @NOTE: type this properly later
  plugins: Plugin[];

  parser: Parser;

  prettyDatafile: boolean;
  stringify: boolean;
}

// rootDirectoryPath: path to the root directory of the project (without ending with a slash)
export function getProjectConfig(rootDirectoryPath: string): ProjectConfig {
  const baseConfig: ProjectConfig = {
    tags: DEFAULT_TAGS,

    parser: DEFAULT_PARSER,

    prettyDatafile: DEFAULT_PRETTY_DATAFILE,
    stringify: true,

    adapter: FilesystemAdapter,

    eventsDirectoryPath: path.join(rootDirectoryPath, EVENTS_DIRECTORY_NAME),
    attributesDirectoryPath: path.join(rootDirectoryPath, ATTRIBUTES_DIRECTORY_NAME),
    destinationsDirectoryPath: path.join(rootDirectoryPath, DESTINATIONS_DIRECTORY_NAME),
    statesDirectoryPath: path.join(rootDirectoryPath, STATES_DIRECTORY_NAME),
    effectsDirectoryPath: path.join(rootDirectoryPath, EFFECTS_DIRECTORY_NAME),
    testsDirectoryPath: path.join(rootDirectoryPath, TESTS_DIRECTORY_NAME),
    datafilesDirectoryPath: path.join(rootDirectoryPath, DATAFILES_DIRECTORY_NAME),
    datafileNamePattern: DATAFILE_NAME_PATTERN,
    systemDirectoryPath: path.join(rootDirectoryPath, SYSTEM_DIRECTORY_NAME),
    catalogExportDirectoryPath: path.join(rootDirectoryPath, CATALOG_EXPORT_DIRECTORY_NAME),

    plugins: [],
  };

  const configModulePath = path.join(rootDirectoryPath, CONFIG_MODULE_NAME);
  const customConfig = require(configModulePath);

  const mergedConfig = {};

  Object.keys(baseConfig).forEach((key) => {
    mergedConfig[key] =
      typeof customConfig[key] !== "undefined" ? customConfig[key] : baseConfig[key];

    if (key.endsWith("Path") && mergedConfig[key].indexOf(ROOT_DIR_PLACEHOLDER) !== -1) {
      mergedConfig[key] = mergedConfig[key].replace(ROOT_DIR_PLACEHOLDER, rootDirectoryPath);
    }
  });

  const finalConfig = mergedConfig as ProjectConfig;

  if (typeof finalConfig.parser === "string") {
    const allowedParsers = Object.keys(parsers);
    if (allowedParsers.indexOf(finalConfig.parser) === -1) {
      throw new Error(`Invalid parser: ${finalConfig.parser}`);
    }

    finalConfig.parser = parsers[finalConfig.parser];
  }

  return finalConfig as ProjectConfig;
}

export interface ShowProjectConfigOptions {
  json?: boolean;
  pretty?: boolean;
}

export function showProjectConfig(
  projectConfig: ProjectConfig,
  options: ShowProjectConfigOptions = {},
) {
  if (options.json) {
    console.log(
      options.pretty ? JSON.stringify(projectConfig, null, 2) : JSON.stringify(projectConfig),
    );

    return;
  }

  console.log("\nProject configuration:\n");

  const keys = Object.keys(projectConfig);
  const longestKeyLength = keys.reduce((acc, key) => (key.length > acc ? key.length : acc), 0);
  const ignoreKeys = ["adapter", "parser"];

  for (const key of keys) {
    if (ignoreKeys.indexOf(key) !== -1) {
      continue;
    }

    console.log(`  - ${key.padEnd(longestKeyLength, " ")}: ${projectConfig[key]}`);
  }
}

export const configPlugin: Plugin = {
  command: "config",
  handler: async ({ rootDirectoryPath, parsed }) => {
    const projectConfig = getProjectConfig(rootDirectoryPath);
    showProjectConfig(projectConfig, {
      json: parsed.json,
      pretty: parsed.pretty,
    });
  },
  examples: [
    {
      command: "config",
      description: "show the project configuration",
    },
    {
      command: "config --print",
      description: "show the project configuration as JSON",
    },
    {
      command: "config --print --pretty",
      description: "show the project configuration (as pretty JSON)",
    },
  ],
};
