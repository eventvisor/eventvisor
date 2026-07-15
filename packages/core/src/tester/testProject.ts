import chalk from "chalk";

import { Dependencies } from "../dependencies";
import { Plugin } from "../cli";
import { buildDatafile } from "../builder";
import { prettyDuration } from "../utils";
import { printTestResult } from "./printTestResult";
import { executeTest } from "./executeTest";
import { getProjectSetExecutions } from "../sets";

export interface TestProjectOptions {
  keyPattern?: string;
  entityType?: string;
  assertionPattern?: string;
  onlyFailures?: boolean;
  quiet?: boolean;
  verbose?: boolean;
  tag?: string;
  target?: string;
  set?: string;
}

async function testSingleProject(
  deps: Dependencies,
  options: TestProjectOptions,
): Promise<boolean> {
  const beforeDatafileBuild = new Date();
  console.log("Building datafile...");

  const datafileContent = await buildDatafile(deps, { tag: options.tag, target: options.target });
  const afterDatafileBuild = new Date();
  console.log(
    `Datafile built in ${afterDatafileBuild.getTime() - beforeDatafileBuild.getTime()}ms`,
  );

  const tests = await deps.datasource.listTests();

  const totals = {
    specsPassed: 0,
    specsFailed: 0,
    assertionsPassed: 0,
    assertionsFailed: 0,
  };

  let hasFailures = false;

  const start = new Date();

  for (const test of tests) {
    // @TODO: use regex?
    if (options.keyPattern && !test.includes(options.keyPattern)) {
      continue;
    }

    const testContent = await deps.datasource.readTest(test);
    const testResult = await executeTest({
      deps,
      datafileContent,
      test: testContent,
      cliOptions: options,
    });

    if (!testResult.passed) {
      hasFailures = true;
      totals.specsFailed++;
    } else {
      totals.specsPassed++;
    }

    for (const assertion of testResult.assertions) {
      if (assertion.passed) {
        totals.assertionsPassed++;
      } else {
        totals.assertionsFailed++;
      }
    }

    if (typeof options.onlyFailures === "undefined" || !testResult.passed) {
      // print
      printTestResult({
        testName: test,
        test: testContent,
        testResult,
        deps,
      });
    }
  }

  console.log(`\n\n`);

  if (hasFailures) {
    console.log(
      chalk.red(`Test specs: ${totals.specsPassed} passed, ${totals.specsFailed} failed`),
    );
    console.log(
      chalk.red(`Assertions: ${totals.assertionsPassed} passed, ${totals.assertionsFailed} failed`),
    );
  } else {
    console.log(
      chalk.green(`Test specs: ${totals.specsPassed} passed, ${totals.specsFailed} failed`),
    );
    console.log(
      chalk.green(
        `Assertions: ${totals.assertionsPassed} passed, ${totals.assertionsFailed} failed`,
      ),
    );
  }

  const end = new Date();
  console.log(`Time:       ${prettyDuration(end.getTime() - start.getTime())}`);

  if (hasFailures) {
    return false;
  }

  return true;
}

export async function testProject(
  deps: Dependencies,
  options: TestProjectOptions,
): Promise<boolean> {
  const executions = await getProjectSetExecutions(
    deps.projectConfig,
    deps.datasource,
    options.set,
  );
  let passed = true;
  for (const execution of executions) {
    const result = await testSingleProject(
      { ...deps, projectConfig: execution.projectConfig, datasource: execution.datasource },
      options,
    );
    if (!result) passed = false;
  }
  return passed;
}

export const testPlugin: Plugin = {
  command: "test",
  options: {
    set: { type: "string" },
    tag: { type: "string" },
    target: { type: "string" },
    keyPattern: { type: "string" },
    assertionPattern: { type: "string" },
    onlyFailures: { type: "boolean" },
    quiet: { type: "boolean" },
    verbose: { type: "boolean" },
  },
  handler: async function ({ rootDirectoryPath, projectConfig, datasource, parsed }) {
    return testProject(
      {
        rootDirectoryPath,
        projectConfig,
        datasource,
        options: parsed,
      },
      parsed as TestProjectOptions,
    );
  },
  examples: [],
};
