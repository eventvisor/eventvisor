import { Dependencies } from "../dependencies";
import { Plugin } from "../cli";
import { buildSelectedDatafile } from "../builder";
import { prettyDuration } from "../utils";
import { printTestResult } from "./printTestResult";
import { executeTest } from "./executeTest";
import { getProjectSetExecutions, printSetHeader } from "../sets";
import {
  CLI_COLOR_CYAN,
  CLI_FORMAT_BOLD,
  CLI_FORMAT_GREEN,
  CLI_FORMAT_RED,
  colorize,
} from "./cliFormat";

export interface TestProjectOptions {
  keyPattern?: string;
  entityType?: string;
  assertionPattern?: string;
  onlyFailures?: boolean;
  quiet?: boolean;
  verbose?: boolean;
  tag?: string | string[];
  target?: string | string[];
  set?: string;
}

async function testSingleProject(
  deps: Dependencies,
  options: TestProjectOptions,
): Promise<boolean> {
  const beforeDatafileBuild = new Date();
  console.log("");
  console.log(CLI_FORMAT_BOLD, "Testing Eventvisor project");
  console.log(`  ${colorize("•", CLI_COLOR_CYAN)} Building test datafile`);

  const datafileContent = await buildSelectedDatafile(deps, {
    tag: options.tag,
    target: options.target,
  });
  const afterDatafileBuild = new Date();
  console.log(
    `  ${colorize("✔", 32)} Datafile built in ${afterDatafileBuild.getTime() - beforeDatafileBuild.getTime()}ms`,
  );

  const tests = await deps.datasource.listTests();

  const totals = {
    specsPassed: 0,
    specsFailed: 0,
    assertionsPassed: 0,
    assertionsFailed: 0,
  };

  let hasFailures = false;
  let matchedSpecs = 0;

  const start = new Date();

  for (const test of tests) {
    // @TODO: use regex?
    if (options.keyPattern && !test.includes(options.keyPattern)) {
      continue;
    }
    matchedSpecs++;

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

  if (
    matchedSpecs === 0 ||
    (options.assertionPattern && totals.assertionsPassed + totals.assertionsFailed === 0)
  ) {
    hasFailures = true;
    console.log(
      CLI_FORMAT_RED,
      matchedSpecs === 0
        ? "No test specs matched the requested pattern"
        : "No assertions matched the requested pattern",
    );
  }

  console.log("");

  if (hasFailures) {
    console.log(
      CLI_FORMAT_RED,
      `Test specs: ${totals.specsPassed} passed, ${totals.specsFailed} failed`,
    );
    console.log(
      CLI_FORMAT_RED,
      `Assertions: ${totals.assertionsPassed} passed, ${totals.assertionsFailed} failed`,
    );
  } else {
    console.log(
      CLI_FORMAT_GREEN,
      `Test specs: ${totals.specsPassed} passed, ${totals.specsFailed} failed`,
    );
    console.log(
      CLI_FORMAT_GREEN,
      `Assertions: ${totals.assertionsPassed} passed, ${totals.assertionsFailed} failed`,
    );
  }

  const end = new Date();
  console.log(CLI_FORMAT_BOLD, `Time:       ${prettyDuration(end.getTime() - start.getTime())}`);
  console.log("");

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
    printSetHeader(deps.projectConfig, execution.set);
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
  description: "run project test specifications",
  options: {
    set: { type: "string", description: "test a project Set" },
    tag: { type: "array", description: "include one or more tags" },
    target: { type: "array", description: "include one or more Targets" },
    keyPattern: { type: "string", alias: "key-pattern", description: "filter test keys" },
    assertionPattern: {
      type: "string",
      alias: "assertion-pattern",
      description: "filter assertion descriptions",
    },
    onlyFailures: {
      type: "boolean",
      alias: "only-failures",
      description: "print only failed assertions",
    },
    quiet: { type: "boolean", description: "suppress assertion output" },
    verbose: { type: "boolean", description: "print expanded assertion details" },
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
  examples: [
    { command: "test", description: "run every project test" },
    { command: "test --target web --only-failures", description: "test one Target" },
  ],
};
