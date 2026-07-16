import type { ProjectConfig } from "./config";
import type { Datasource } from "./datasource";
import { CLI_FORMAT_BOLD } from "./tester/cliFormat";

export interface ProjectSetExecution {
  set: string;
  projectConfig: ProjectConfig;
  datasource: Datasource;
}

export async function getProjectSetExecutions(
  projectConfig: ProjectConfig,
  datasource: Datasource,
  selectedSet?: string,
): Promise<ProjectSetExecution[]> {
  if (!projectConfig.sets) {
    if (selectedSet) throw new Error("This project does not have sets enabled.");
    return [{ set: "", projectConfig, datasource }];
  }

  const availableSets = await datasource.listSets();
  if (selectedSet && !availableSets.includes(selectedSet)) {
    throw new Error(
      `Unknown set "${selectedSet}". Available sets: ${availableSets.join(", ") || "none"}.`,
    );
  }

  const sets = selectedSet ? [selectedSet] : availableSets;
  if (sets.length === 0) {
    throw new Error(`No sets found in ${projectConfig.setsDirectoryPath}.`);
  }

  return sets.map((set) => {
    const setDatasource = datasource.forSet(set);
    return { set, projectConfig: setDatasource.getConfig(), datasource: setDatasource };
  });
}

export async function getSelectedProjectExecution(
  projectConfig: ProjectConfig,
  datasource: Datasource,
  selectedSet?: string,
) {
  const executions = await getProjectSetExecutions(projectConfig, datasource, selectedSet);
  if (executions.length !== 1) {
    throw new Error("Pass --set=<set> for this command in a project with sets enabled.");
  }
  return executions[0];
}

export function assertProjectSetJsonSelection(
  projectConfig: ProjectConfig,
  selectedSet: string | undefined,
  json: boolean | undefined,
) {
  if (projectConfig.sets && json && !selectedSet) {
    throw new Error("Pass --set=<set> when using --json in a project with sets enabled.");
  }
}

export function printSetHeader(projectConfig: ProjectConfig, set: string, json = false) {
  if (!projectConfig.sets || json) return;
  console.log("");
  console.log(CLI_FORMAT_BOLD, `Set "${set}"`);
}
