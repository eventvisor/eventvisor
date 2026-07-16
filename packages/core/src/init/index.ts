import axios from "axios";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as tar from "tar";

import type { Plugin } from "../cli";
import { CLI_COLOR_CYAN, CLI_FORMAT_GREEN, colorize } from "../tester/cliFormat";

export const DEFAULT_PROJECT = "yml";
const REPOSITORY = "eventvisor/eventvisor";
const BRANCH = "main";
const TAR_URL = `https://codeload.github.com/${REPOSITORY}/tar.gz/${BRANCH}`;

function archiveProjectPath(project: string) {
  return `eventvisor-${BRANCH}/projects/project-${project}/`;
}

export async function initProject(
  directoryPath: string,
  project = DEFAULT_PROJECT,
  force = false,
): Promise<boolean> {
  fs.mkdirSync(directoryPath, { recursive: true });
  if (!force && fs.readdirSync(directoryPath).length > 0) {
    throw new Error(`Directory ${directoryPath} is not empty. Pass --force to overwrite files.`);
  }

  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "eventvisor-init-"));
  try {
    const response = await axios.get(TAR_URL, { responseType: "stream" });
    await new Promise<void>((resolve, reject) => {
      response.data
        .pipe(
          tar.x({
            C: temporary,
            filter: (entry) => entry.startsWith(archiveProjectPath(project)),
            strip: 3,
          }),
        )
        .once("error", reject)
        .once("finish", resolve);
    });
    if (fs.readdirSync(temporary).length === 0) {
      throw new Error(`Unknown project scaffold "${project}".`);
    }
    fs.cpSync(temporary, directoryPath, { recursive: true, force });
    console.log("");
    console.log(CLI_FORMAT_GREEN, "Eventvisor project scaffolded");
    console.log(`  ${colorize("Directory", CLI_COLOR_CYAN)}: ${directoryPath}`);
    console.log("");
    console.log('Run "npm install" to install its dependencies.');
    console.log("");
    return true;
  } catch (error) {
    throw new Error(`Could not initialize Eventvisor project: ${(error as Error).message}`);
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
}

export const initPlugin: Plugin = {
  command: "init",
  options: {
    project: { type: "string", description: "project scaffold name" },
    force: { type: "boolean", description: "overwrite files in a non-empty directory" },
  },
  handler: async ({ rootDirectoryPath, parsed }) =>
    initProject(rootDirectoryPath, parsed.project, parsed.force),
  examples: [
    { command: "init", description: "scaffold a project in the current directory" },
    { command: "init --project=yml", description: "scaffold a named example project" },
    { command: "init --project=demo", description: "scaffold the e-commerce demo project" },
    {
      command: "init --project=environments",
      description: "scaffold a project using Sets as environments",
    },
  ],
};
