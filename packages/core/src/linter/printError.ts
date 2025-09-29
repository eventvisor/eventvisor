import * as path from "path";

import * as z from "zod";
import chalk from "chalk";

import { ProjectConfig, CustomParser } from "../config";

export interface PrintErrorOptions {
  entityType: string;
  entityKey: string;
  error: z.ZodError;
  projectConfig: ProjectConfig;
}

function getFilePath(options: PrintErrorOptions) {
  const { entityType, entityKey, projectConfig } = options;

  const extension = (projectConfig.parser as CustomParser).extension;

  let directoryPath = "";
  if (entityType === "event") {
    directoryPath = projectConfig.eventsDirectoryPath;
  } else if (entityType === "attribute") {
    directoryPath = projectConfig.attributesDirectoryPath;
  } else if (entityType === "destination") {
  } else if (entityType === "test") {
    directoryPath = projectConfig.testsDirectoryPath;
  } else {
    throw new Error(`Unknown entity type: ${entityType}`);
  }

  return path.join(directoryPath, entityKey + "." + extension);
}

function prefixLines(str: string, prefix: string) {
  return str
    .split("\n")
    .map((line) => prefix + line)
    .join("\n");
}

export function printError(options: PrintErrorOptions) {
  const { error } = options;

  console.log("\n");

  console.log(chalk.bold.red.underline(getFilePath(options)));

  console.log(prefixLines(z.prettifyError(error), "  "));
}
