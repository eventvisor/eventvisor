import axios from "axios";
import * as tar from "tar";

import { Plugin } from "../cli";

export const DEFAULT_PROJECT = "yml";

export const PROJECTS_ORG_NAME = "eventvisor";
export const PROJECTS_REPO_NAME = "eventvisor";
export const PROJECTS_BRANCH_NAME = "main";

export const PROJECTS_TAR_URL = `https://codeload.github.com/${PROJECTS_ORG_NAME}/${PROJECTS_REPO_NAME}/tar.gz/${PROJECTS_BRANCH_NAME}`;

function getProjectPath(projectName: string) {
  return `${PROJECTS_REPO_NAME}-${PROJECTS_BRANCH_NAME}/projects/project-${projectName}/`;
}

export function initProject(
  directoryPath: string,
  projectName: string = DEFAULT_PROJECT,
): Promise<boolean> {
  return new Promise(function (resolve) {
    axios.get(PROJECTS_TAR_URL, { responseType: "stream" }).then((response) => {
      response.data
        .pipe(
          tar.x({
            C: directoryPath,
            filter: (path) => path.indexOf(getProjectPath(projectName)) === 0,
            strip: 3,
          }),
        )
        .on("error", (e) => {
          console.error(e);

          resolve(false);
        })
        .on("finish", () => {
          console.log(`Project scaffolded in ${directoryPath}`);
          console.log(``);
          console.log(`Please run "npm install" in the directory above.`);

          resolve(true);
        });
    });
  });
}

export const initPlugin: Plugin = {
  command: "init",
  handler: async function (options) {
    const { rootDirectoryPath, parsed } = options;

    await initProject(rootDirectoryPath, parsed.project);
  },
  examples: [
    {
      command: "init",
      description: "scaffold a new project in current directory",
    },
    {
      command: "init --project=projectName",
      description: "scaffold a new project in current directory from known example",
    },
  ],
};
