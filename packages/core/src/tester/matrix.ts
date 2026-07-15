import type { AssertionMatrix, Value } from "@eventvisor/types";

export interface ExpandedAssertion<T> {
  assertion: T;
  assertionIndex: number;
  matrixIndex?: number;
  matrixCount?: number;
}

export function getMatrixCombinations(matrix: AssertionMatrix): Record<string, Value>[] {
  const entries = Object.entries(matrix);
  if (entries.length === 0) return [];

  return entries.reduce<Record<string, Value>[]>((all, [key, values]) => {
    const base = all.length ? all : [{}];
    return base.flatMap((combination) => values.map((value) => ({ ...combination, [key]: value })));
  }, []);
}

function applyValue(value: unknown, combination: Record<string, Value>): unknown {
  if (typeof value === "string") {
    const variables = value.match(/\${{(.+?)}}/g);
    if (!variables) return value;
    if (variables.length === 1 && value.startsWith("${{") && value.endsWith("}}")) {
      return combination[value.slice(3, -2).trim()];
    }
    return value.replace(/\${{(.+?)}}/g, (_, key) => String(combination[key.trim()]));
  }
  if (Array.isArray(value)) return value.map((item) => applyValue(item, combination));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [key, applyValue(child, combination)]),
    );
  }
  return value;
}

export function expandAssertions<T extends { matrix?: AssertionMatrix; description?: string }>(
  assertions: T[],
): ExpandedAssertion<T>[] {
  return assertions.flatMap((source, assertionIndex) => {
    if (!source.matrix) return [{ assertion: { ...source }, assertionIndex }];
    const combinations = getMatrixCombinations(source.matrix);
    return combinations.map((combination, matrixIndex) => {
      const assertion = { ...source };
      delete assertion.matrix;
      return {
        assertion: applyValue(assertion, combination) as T,
        assertionIndex,
        matrixIndex,
        matrixCount: combinations.length,
      };
    });
  });
}
