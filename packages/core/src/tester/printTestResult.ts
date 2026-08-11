import * as path from "path";
import { Test } from "@eventvisor/types";

import { Dependencies } from "../dependencies";
import { TestResult } from "./executeTest";
import {
  CLI_COLOR_CYAN,
  CLI_FORMAT_BOLD,
  CLI_FORMAT_GREEN,
  CLI_FORMAT_RED,
  colorize,
} from "./cliFormat";

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

  console.log("");
  console.log(colorize(`Testing: ${relativeTestPath}`, CLI_COLOR_CYAN));

  const entityType = ["event", "attribute", "destination", "effect"].find((type) => type in test);
  if (entityType) {
    const key = test[entityType];
    console.log(
      CLI_FORMAT_BOLD,
      `  ${entityType.charAt(0).toUpperCase()}${entityType.slice(1)} "${key}":`,
    );
  }

  if (testResult.assertions.length > 0) {
    for (const assertion of testResult.assertions) {
      if (assertion.passed) {
        console.log(CLI_FORMAT_GREEN, `  ✔ ${assertion.description}`);
      } else {
        console.error(CLI_FORMAT_RED, `  ✘ ${assertion.description}`);
      }

      if (assertion.errors) {
        for (const error of assertion.errors) {
          console.error(CLI_FORMAT_RED, prefixLines(error, "    "));
        }
      }
    }
  }
}
