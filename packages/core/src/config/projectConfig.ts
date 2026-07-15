import * as path from "path";

import { Parser, parsers } from "./parsers";
import { FilesystemAdapter } from "../datasource/filesystemAdapter";
import type { Plugin } from "../cli";
import type { Adapter } from "../datasource/adapter";

export type AdapterConstructor = new (config: ProjectConfig, rootDirectoryPath?: string) => Adapter;

export const EVENTS_DIRECTORY_NAME = "events";
export const ATTRIBUTES_DIRECTORY_NAME = "attributes";
export const DESTINATIONS_DIRECTORY_NAME = "destinations";
export const STATES_DIRECTORY_NAME = "states";
export const EFFECTS_DIRECTORY_NAME = "effects";
export const TESTS_DIRECTORY_NAME = "tests";
export const TARGETS_DIRECTORY_NAME = "targets";
export const SETS_DIRECTORY_NAME = "sets";
export const SYSTEM_DIRECTORY_NAME = ".eventvisor";
export const DATAFILES_DIRECTORY_NAME = "datafiles";
export const DATAFILE_NAME_PATTERN = "eventvisor-%s.json";
export const CATALOG_EXPORT_DIRECTORY_NAME = "out";

export const CONFIG_MODULE_NAME = "eventvisor.config.js";
export const ROOT_DIR_PLACEHOLDER = "<rootDir>";

export const DEFAULT_PRETTY_DATAFILE = false;
export const DEFAULT_SETS = false;

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
  targetsDirectoryPath: string;
  setsDirectoryPath: string;
  datafilesDirectoryPath: string;
  systemDirectoryPath: string;
  catalogExportDirectoryPath: string;
  datafileNamePattern: string;

  tags: string[];
  sets: boolean;

  adapter: AdapterConstructor;
  plugins: Plugin[];

  parser: Parser;

  prettyDatafile: boolean;
  stringify: boolean;
}

// rootDirectoryPath: path to the root directory of the project (without ending with a slash)
export function getProjectConfig(rootDirectoryPath: string): ProjectConfig {
  const baseConfig: ProjectConfig = {
    tags: DEFAULT_TAGS,
    sets: DEFAULT_SETS,

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
    targetsDirectoryPath: path.join(rootDirectoryPath, TARGETS_DIRECTORY_NAME),
    setsDirectoryPath: path.join(rootDirectoryPath, SETS_DIRECTORY_NAME),
    datafilesDirectoryPath: path.join(rootDirectoryPath, DATAFILES_DIRECTORY_NAME),
    datafileNamePattern: DATAFILE_NAME_PATTERN,
    systemDirectoryPath: path.join(rootDirectoryPath, SYSTEM_DIRECTORY_NAME),
    catalogExportDirectoryPath: path.join(rootDirectoryPath, CATALOG_EXPORT_DIRECTORY_NAME),

    plugins: [],
  };

  const configModulePath = path.join(rootDirectoryPath, CONFIG_MODULE_NAME);
  const customConfig = require(configModulePath);

  const mergedConfig: Record<string, any> = {};

  Object.keys(baseConfig).forEach((key) => {
    mergedConfig[key] =
      typeof customConfig[key] !== "undefined" ? customConfig[key] : baseConfig[key];

    if (
      key.endsWith("Path") &&
      typeof mergedConfig[key] === "string" &&
      mergedConfig[key].indexOf(ROOT_DIR_PLACEHOLDER) !== -1
    ) {
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

  if (typeof finalConfig.sets !== "boolean") {
    throw new Error(`Invalid sets: ${finalConfig.sets}. It must be a boolean.`);
  }

  if (
    !Array.isArray(finalConfig.tags) ||
    finalConfig.tags.length === 0 ||
    finalConfig.tags.some((tag) => typeof tag !== "string" || !tag.trim())
  ) {
    throw new Error("Invalid tags. Define at least one non-empty string.");
  }
  if (new Set(finalConfig.tags).size !== finalConfig.tags.length) {
    throw new Error("Invalid tags. Tag names must be unique.");
  }
  for (const [key, value] of Object.entries(finalConfig)) {
    if (key.endsWith("Path") && typeof value !== "string") {
      throw new Error(`Invalid ${key}. It must be a string.`);
    }
  }
  if (
    typeof finalConfig.datafileNamePattern !== "string" ||
    !finalConfig.datafileNamePattern.includes("%s")
  ) {
    throw new Error('Invalid datafileNamePattern. It must contain "%s".');
  }
  if (
    typeof finalConfig.prettyDatafile !== "boolean" ||
    typeof finalConfig.stringify !== "boolean"
  ) {
    throw new Error("Invalid datafile options. prettyDatafile and stringify must be booleans.");
  }
  if (typeof finalConfig.adapter !== "function") {
    throw new Error("Invalid adapter. It must be a constructor.");
  }
  if (!Array.isArray(finalConfig.plugins)) {
    throw new Error("Invalid plugins. It must be an array.");
  }

  return finalConfig as ProjectConfig;
}

export function getProjectConfigForSet(projectConfig: ProjectConfig, set: string): ProjectConfig {
  const setRootDirectoryPath = path.join(projectConfig.setsDirectoryPath, set);

  return {
    ...projectConfig,
    eventsDirectoryPath: path.join(setRootDirectoryPath, EVENTS_DIRECTORY_NAME),
    attributesDirectoryPath: path.join(setRootDirectoryPath, ATTRIBUTES_DIRECTORY_NAME),
    destinationsDirectoryPath: path.join(setRootDirectoryPath, DESTINATIONS_DIRECTORY_NAME),
    effectsDirectoryPath: path.join(setRootDirectoryPath, EFFECTS_DIRECTORY_NAME),
    testsDirectoryPath: path.join(setRootDirectoryPath, TESTS_DIRECTORY_NAME),
    targetsDirectoryPath: path.join(setRootDirectoryPath, TARGETS_DIRECTORY_NAME),
    statesDirectoryPath: path.join(projectConfig.systemDirectoryPath, SETS_DIRECTORY_NAME, set),
    systemDirectoryPath: path.join(projectConfig.systemDirectoryPath, SETS_DIRECTORY_NAME, set),
    datafilesDirectoryPath: path.join(
      projectConfig.datafilesDirectoryPath,
      SETS_DIRECTORY_NAME,
      set,
    ),
    catalogExportDirectoryPath: path.join(
      projectConfig.catalogExportDirectoryPath,
      SETS_DIRECTORY_NAME,
      set,
    ),
  };
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
      command: "config --json",
      description: "show the project configuration as JSON",
    },
    {
      command: "config --json --pretty",
      description: "show the project configuration (as pretty JSON)",
    },
  ],
};
