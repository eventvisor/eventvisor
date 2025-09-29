import * as path from "path";
import chalk from "chalk";

import { Test } from "@eventvisor/types";

import { Dependencies } from "../dependencies";
import { TestResult } from "./executeTest";

function prefixLines(str: string, prefix: string) {
  return str.replace(/^/gm, prefix);
}

export interface PrintTestResultOptions {
  testName: string;
  test: Test;
  testResult: TestResult;
  deps: Dependencies;
}

export function printTestResult(options: PrintTestResultOptions) {
  const { testName, test, testResult, deps } = options;
  const { projectConfig, rootDirectoryPath, datasource } = deps;

  const relativeTestPath = path.relative(
    rootDirectoryPath,
    path.join(projectConfig.testsDirectoryPath, testName + "." + datasource.getExtension()),
  );

  console.log(`\n\n`);

  if (testResult.passed) {
    console.log(chalk.green(`Testing: ${relativeTestPath}`));
  } else {
    console.error(chalk.red(`Testing: ${relativeTestPath}`));
  }

  if ("attribute" in test) {
    if (testResult.passed) {
      console.log(chalk.green(`  Attribute "${chalk.green(test.attribute)}":`));
    } else {
      console.error(chalk.red(`  Attribute "${chalk.red(test.attribute)}":`));
    }
  }

  if (testResult.assertions.length > 0) {
    for (const assertion of testResult.assertions) {
      if (assertion.passed) {
        console.log(chalk.green(`  ✓ ${assertion.description}`));
      } else {
        console.error(chalk.red(`  ✗ ${assertion.description}`));
      }

      if (assertion.errors) {
        for (const error of assertion.errors) {
          console.error(chalk.red(prefixLines(error, "    ")));
        }
      }
    }
  }
}
