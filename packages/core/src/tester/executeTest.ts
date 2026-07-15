import type { Action, DatafileContent, Test, Value } from "@eventvisor/types";

import type { TestProjectOptions } from "./testProject";
import type { Dependencies } from "../dependencies";
import { createTestInstance } from "./createTestInstance";
import { expandAssertions } from "./matrix";

export interface TestAssertionResult {
  passed: boolean;
  description?: string;
  assertionIndex?: number;
  matrixIndex?: number;
  matrixCount?: number;
  errors?: string[];
}

export interface TestResult {
  passed: boolean;
  assertions: TestAssertionResult[];
}

export interface ExecuteTestOptions {
  deps: Dependencies;
  datafileContent: DatafileContent;
  test: Test;
  cliOptions: TestProjectOptions;
}

function equal(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (!a || !b || typeof a !== "object" || typeof b !== "object") return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  return (
    aKeys.length === bKeys.length &&
    aKeys.every((key) => Object.prototype.hasOwnProperty.call(b, key) && equal(a[key], b[key]))
  );
}

function addComparison(
  result: TestAssertionResult,
  field: string,
  expected: unknown,
  actual: unknown,
) {
  if (equal(expected, actual)) return;
  result.passed = false;
  result.errors?.push(
    `${field}:\n  expected: ${JSON.stringify(expected, null, 2)}\n  received: ${JSON.stringify(actual, null, 2)}`,
  );
}

async function setAttributes(
  e: ReturnType<typeof createTestInstance>["e"],
  values?: Record<string, Value>,
) {
  for (const [name, value] of Object.entries(values || {})) await e.setAttribute(name, value);
}

async function runActions(e: ReturnType<typeof createTestInstance>["e"], actions?: Action[]) {
  for (const action of actions || []) {
    if (action.type === "track") await e.track(action.name, action.value);
    else if (action.type === "setAttribute") await e.setAttribute(action.name, action.value);
    else await e.removeAttribute(action.name);
  }
}

function createResult(expanded: ReturnType<typeof expandAssertions>[number]): TestAssertionResult {
  return {
    passed: true,
    description: expanded.assertion.description,
    assertionIndex: expanded.assertionIndex,
    matrixIndex: expanded.matrixIndex,
    matrixCount: expanded.matrixCount,
    errors: [],
  };
}

export async function executeTest(options: ExecuteTestOptions): Promise<TestResult> {
  const { datafileContent, test, cliOptions, deps } = options;
  const results: TestAssertionResult[] = [];

  for (const expanded of expandAssertions(test.assertions)) {
    const assertion = expanded.assertion as any;
    if (
      cliOptions.assertionPattern &&
      !assertion.description?.includes(cliOptions.assertionPattern)
    ) {
      continue;
    }
    const result = createResult(expanded);
    const instance = createTestInstance({
      datafile: datafileContent,
      cliOptions,
      withLookups: assertion.withLookups,
    });
    const { e } = instance;

    try {
      await e.onReady();
      await setAttributes(e, assertion.withAttributes);

      if ("attribute" in test) {
        if (Object.prototype.hasOwnProperty.call(assertion, "setAttribute")) {
          await e.setAttribute(test.attribute, assertion.setAttribute);
        }
        const isSet = e.isAttributeSet(test.attribute);
        if (typeof assertion.expectedToBeValid === "boolean") {
          addComparison(result, "expectedToBeValid", assertion.expectedToBeValid, isSet);
        }
        if (typeof assertion.expectedToBeSet === "boolean") {
          addComparison(result, "expectedToBeSet", assertion.expectedToBeSet, isSet);
        }
        if (Object.prototype.hasOwnProperty.call(assertion, "expectedAttribute")) {
          addComparison(
            result,
            "expectedAttribute",
            assertion.expectedAttribute,
            e.getAttributeValue(test.attribute),
          );
        }
      } else if ("event" in test) {
        let tracked: Value | null = null;
        if (Object.prototype.hasOwnProperty.call(assertion, "track")) {
          tracked = await e.track(test.event, assertion.track);
        }
        await runActions(e, assertion.actions);
        if (typeof assertion.expectedToBeValid === "boolean") {
          addComparison(result, "expectedToBeValid", assertion.expectedToBeValid, tracked !== null);
        }
        if (Object.prototype.hasOwnProperty.call(assertion, "expectedEvent")) {
          addComparison(result, "expectedEvent", assertion.expectedEvent, tracked);
        }

        const transported = Object.keys(instance.getBodiesByDestination()).filter(
          (name) => (instance.getBodiesBySingleDestination(name) || []).length > 0,
        );
        if (assertion.expectedDestinations) {
          addComparison(
            result,
            "expectedDestinations",
            [...assertion.expectedDestinations].sort(),
            [...transported].sort(),
          );
        }
        if (assertion.expectedDestinationsByTag) {
          for (const [tag, expected] of Object.entries(assertion.expectedDestinationsByTag) as [
            string,
            string[],
          ][]) {
            const actual: string[] = [];
            for (const name of transported) {
              const destination = await deps.datasource.readDestination(name);
              if (destination.tags?.includes(tag)) actual.push(name);
            }
            addComparison(
              result,
              `expectedDestinationsByTag.${tag}`,
              [...expected].sort(),
              actual.sort(),
            );
          }
        }
      } else if ("effect" in test) {
        await runActions(e, assertion.actions);
        const called = instance.getCalledStepsBySingleEffect(test.effect) || [];
        if (Object.prototype.hasOwnProperty.call(assertion, "expectedState")) {
          addComparison(
            result,
            "expectedState",
            assertion.expectedState,
            e.getStateValue(test.effect),
          );
        }
        if (typeof assertion.expectedToBeHandled === "boolean") {
          addComparison(
            result,
            "expectedToBeHandled",
            assertion.expectedToBeHandled,
            called.length > 0,
          );
        }
        for (const expected of assertion.expectedToBeCalled || []) {
          const actual = called.filter((step) => step.handler === expected.handler).length;
          if (typeof expected.times === "number") {
            addComparison(result, `expectedToBeCalled.${expected.handler}`, expected.times, actual);
          } else if (actual === 0) {
            result.passed = false;
            result.errors?.push(`expectedToBeCalled: handler "${expected.handler}" was not called`);
          }
        }
      } else if ("destination" in test) {
        await runActions(e, assertion.actions);
        if (assertion.assertAfter) {
          await new Promise((resolve) => setTimeout(resolve, assertion.assertAfter));
        }
        const bodies = instance.getBodiesBySingleDestination(test.destination) || [];
        if (typeof assertion.expectedToBeTransported === "boolean") {
          addComparison(
            result,
            "expectedToBeTransported",
            assertion.expectedToBeTransported,
            bodies.length > 0,
          );
        }
        if (Object.prototype.hasOwnProperty.call(assertion, "expectedBody")) {
          addComparison(result, "expectedBody", assertion.expectedBody, bodies[0]);
        }
        if (assertion.expectedBodies)
          addComparison(result, "expectedBodies", assertion.expectedBodies, bodies);
      }
    } finally {
      await e.close();
    }
    results.push(result);
  }

  return { passed: results.every((result) => result.passed), assertions: results };
}
