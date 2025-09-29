import type { DatafileContent, Test, Value } from "@eventvisor/types";

import type { TestProjectOptions } from "./testProject";
import type { Dependencies } from "../dependencies";
import { createTestInstance } from "./createTestInstance";

export interface TestAssertionResult {
  passed: boolean;
  description?: string;
  errors?: string[];
}

export interface TestAssertionResult {
  passed: boolean;
  description?: string;
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

export async function executeTest(options: ExecuteTestOptions) {
  const { datafileContent, test, cliOptions } = options;

  const testResult: TestResult = {
    passed: true,
    assertions: [],
  };

  let testPassed = true;

  /**
   * Attribute
   */
  if ("attribute" in test) {
    // attribute test spec
    const attributeName = test.attribute;
    const assertions = test.assertions;

    for (const assertion of assertions) {
      // @TODO: apply matrix

      if (
        cliOptions.assertionPattern &&
        !assertion.description?.includes(cliOptions.assertionPattern)
      ) {
        continue;
      }

      let assertionPassed = true;

      const { e } = createTestInstance({
        datafile: datafileContent,
        cliOptions,
        withLookups: assertion.withLookups,
      });

      if (assertion.setAttribute) {
        await e.setAttributeAsync(attributeName, assertion.setAttribute);
      }

      const previouslySetAttribute = e.getAttributeValue(attributeName);
      const isAttributeSet = e.isAttributeSet(attributeName);

      const testAssertionResult: TestAssertionResult = {
        passed: assertionPassed,
        description: assertion.description,
        errors: [],
      };

      // expectedToBeValid
      if (typeof assertion.expectedToBeValid === "boolean") {
        if (
          (assertion.expectedToBeValid === true && !isAttributeSet) ||
          (assertion.expectedToBeValid === false && isAttributeSet)
        ) {
          assertionPassed = false;
          testAssertionResult.errors?.push(
            `expectedToBeValid: expected ${assertion.expectedToBeValid}, received ${!assertion.expectedToBeValid}`,
          );
        }
      }

      // expectedToBeSet
      if (typeof assertion.expectedToBeSet === "boolean") {
        if (
          (assertion.expectedToBeSet === true && !isAttributeSet) ||
          (assertion.expectedToBeSet === false && isAttributeSet)
        ) {
          assertionPassed = false;
          testAssertionResult.errors?.push(
            `expectedToBeSet: expected ${assertion.expectedToBeSet}, received ${!assertion.expectedToBeSet}`,
          );
        }
      }

      if (assertion.expectedAttribute) {
        if (!checkIfObjectsAreDeepEqual(previouslySetAttribute, assertion.expectedAttribute)) {
          assertionPassed = false;
          testAssertionResult.errors?.push(
            `expectedAttribute: \n  expected: ${JSON.stringify(assertion.expectedAttribute)}\n  received: ${JSON.stringify(
              previouslySetAttribute,
            )}`,
          );
        }
      }

      testAssertionResult.passed = assertionPassed;

      if (!assertionPassed) {
        testPassed = false;
      }

      testResult.assertions.push(testAssertionResult);
    }
  }

  /**
   * Effect
   */
  if ("effect" in test) {
    const effectName = test.effect;
    const assertions = test.assertions;

    for (const assertion of assertions) {
      // @TODO: apply matrix

      if (
        cliOptions.assertionPattern &&
        !assertion.description?.includes(cliOptions.assertionPattern)
      ) {
        continue;
      }

      let assertionPassed = true;

      const { e, getCalledStepsBySingleEffect } = createTestInstance({
        datafile: datafileContent,
        cliOptions,
        withLookups: assertion.withLookups,
      });

      await e.onReady();

      if (assertion.actions) {
        for (const action of assertion.actions) {
          if (action.type === "track") {
            await e.trackAsync(action.name, action.value);
          } else if (action.type === "setAttribute") {
            await e.setAttributeAsync(action.name, action.value);
          }
        }
      }

      const testAssertionResult: TestAssertionResult = {
        passed: assertionPassed,
        description: assertion.description,
        errors: [],
      };

      // expectedState
      if (assertion.expectedState) {
        const latestState = e.getStateValue(effectName);

        if (!checkIfObjectsAreDeepEqual(latestState, assertion.expectedState)) {
          assertionPassed = false;
          testAssertionResult.errors?.push(
            `expectedState: \n  expected: ${JSON.stringify(assertion.expectedState)}\n  received: ${JSON.stringify(latestState)}`,
          );
        }
      }

      // expectedHandlersToBeCalled
      if (assertion.expectedToBeCalled) {
        const calledSteps = getCalledStepsBySingleEffect(effectName);

        for (const expectedToBeCalled of assertion.expectedToBeCalled) {
          const { handler, times } = expectedToBeCalled;

          const calledStepsForHandler = calledSteps?.filter((step) => step.handler === handler);

          if (times) {
            if (calledStepsForHandler?.length !== times) {
              assertionPassed = false;
              testAssertionResult.errors?.push(
                `expectedToBeCalled: expected handler "${handler}" to be called ${times} times, received ${calledStepsForHandler?.length} times`,
              );
            }
          } else {
            if (!calledStepsForHandler?.length || calledStepsForHandler.length === 0) {
              assertionPassed = false;
              testAssertionResult.errors?.push(
                `expectedToBeCalled: expected handler "${handler}" to be called at least once`,
              );
            }
          }
        }
      }

      testAssertionResult.passed = assertionPassed;

      if (!assertionPassed) {
        testPassed = false;
      }

      testResult.assertions.push(testAssertionResult);
    }
  }

  /**
   * Event
   */
  if ("event" in test) {
    const eventName = test.event;
    const assertions = test.assertions;

    for (const assertion of assertions) {
      // @TODO: apply matrix

      if (
        cliOptions.assertionPattern &&
        !assertion.description?.includes(cliOptions.assertionPattern)
      ) {
        continue;
      }

      let assertionPassed = true;

      const { e } = createTestInstance({
        datafile: datafileContent,
        cliOptions,
        withLookups: assertion.withLookups,
      });

      let trackedEvent: Value | null = null;

      if (assertion.track) {
        trackedEvent = await e.trackAsync(eventName, assertion.track);
      }

      if (assertion.actions) {
        for (const action of assertion.actions) {
          if (action.type === "track") {
            await e.trackAsync(action.name, action.value);
          } else if (action.type === "setAttribute") {
            await e.setAttributeAsync(action.name, action.value);
          }
        }
      }

      const testAssertionResult: TestAssertionResult = {
        passed: assertionPassed,
        description: assertion.description,
        errors: [],
      };

      // expectedToBeValid
      if (typeof assertion.expectedToBeValid === "boolean") {
        if (
          (assertion.expectedToBeValid === true && !trackedEvent) ||
          (assertion.expectedToBeValid === false && trackedEvent)
        ) {
          assertionPassed = false;
          testAssertionResult.errors?.push(
            `expectedToBeValid: expected ${assertion.expectedToBeValid}, received ${!assertion.expectedToBeValid}`,
          );
        }
      }

      // expectedToContinue
      if (assertion.expectedToContinue) {
        // @TODO: implement
      }

      // expectedEvent
      if (assertion.expectedEvent) {
        if (!checkIfObjectsAreDeepEqual(trackedEvent, assertion.expectedEvent)) {
          assertionPassed = false;
          testAssertionResult.errors?.push(
            `expectedEvent: \n  expected: ${JSON.stringify(assertion.expectedEvent)}\n  received: ${JSON.stringify(trackedEvent)}`,
          );
        }
      }

      // expectedDestinations
      if (assertion.expectedDestinations) {
        // if (!assertion.expectedDestinations.includes(m.getDestinationName())) {
        //   assertionPassed = false;
        //   testAssertionResult.errors?.push(
        //     `expectedDestinations: expected ${assertion.expectedDestinations.join(", ")}, received ${m.getDestinationName()}`,
        //   );
        // }
      }

      // expectedDestinationsByTag
      if (assertion.expectedDestinationsByTag) {
        // @TODO: implement
      }

      testAssertionResult.passed = assertionPassed;

      if (!assertionPassed) {
        testPassed = false;
      }

      testResult.assertions.push(testAssertionResult);
    }
  }

  /**
   * Destination
   */
  if ("destination" in test) {
    const destinationName = test.destination;
    const assertions = test.assertions;

    for (const assertion of assertions) {
      // @TODO: apply matrix

      if (
        cliOptions.assertionPattern &&
        !assertion.description?.includes(cliOptions.assertionPattern)
      ) {
        continue;
      }

      let assertionPassed = true;

      const { e, getBodiesBySingleDestination } = createTestInstance({
        datafile: datafileContent,
        cliOptions,
        withLookups: assertion.withLookups,
      });

      if (assertion.actions) {
        for (const action of assertion.actions) {
          if (action.type === "track") {
            await e.trackAsync(action.name, action.value);
          } else if (action.type === "setAttribute") {
            await e.setAttributeAsync(action.name, action.value);
          }
        }
      }

      const testAssertionResult: TestAssertionResult = {
        passed: assertionPassed,
        description: assertion.description,
        errors: [],
      };

      // expectedToBeTransported
      if (typeof assertion.expectedToBeTransported === "boolean") {
        const bodies = getBodiesBySingleDestination(destinationName);

        if (
          (assertion.expectedToBeTransported === false && bodies && bodies.length > 0) ||
          (assertion.expectedToBeTransported === true && (!bodies || bodies.length === 0))
        ) {
          assertionPassed = false;
          testAssertionResult.errors?.push(
            `expectedToBeTransported: expected ${assertion.expectedToBeTransported}, received ${!assertion.expectedToBeTransported}`,
          );
        }
      }

      // expectedBody
      if (assertion.expectedBody) {
        const bodies = getBodiesBySingleDestination(destinationName);
        if (!checkIfObjectsAreDeepEqual(bodies && bodies[0], assertion.expectedBody)) {
          assertionPassed = false;
          testAssertionResult.errors?.push(
            `expectedBody: \n  expected: ${JSON.stringify(assertion.expectedBody, null, 2)}\n  received: ${JSON.stringify(bodies && bodies[0], null, 2)}`,
          );
        }
      }

      // @TODO: expectedBodies

      testAssertionResult.passed = assertionPassed;

      if (!assertionPassed) {
        testPassed = false;
      }

      testResult.assertions.push(testAssertionResult);
    }
  }

  testResult.passed = testPassed;

  return testResult;
}

function checkIfObjectsAreDeepEqual(a: any, b: any) {
  // Handle null/undefined cases
  if (a === null || b === null || a === undefined || b === undefined) {
    return a === b;
  }

  // Handle primitive types
  if (typeof a !== "object" || typeof b !== "object") {
    return a === b;
  }

  // Handle arrays
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) {
      return false;
    }
    return a.every((item, index) => checkIfObjectsAreDeepEqual(item, b[index]));
  }

  // Handle objects
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);

  if (aKeys.length !== bKeys.length) {
    return false;
  }

  return aKeys.every((key) => {
    if (!Object.prototype.hasOwnProperty.call(b, key)) {
      return false;
    }
    return checkIfObjectsAreDeepEqual(a[key], b[key]);
  });
}
