import type { AssertionMatrix, Value } from "@eventvisor/types";

export function combinations(matrix: AssertionMatrix): Record<string, Value>[] {
  return Object.entries(matrix).reduce<Record<string, Value>[]>(
    (all, [key, values]) =>
      (all.length ? all : [{}]).flatMap((item) =>
        values.map((value) => ({ ...item, [key]: value })),
      ),
    [],
  );
}

export function applyMatrix(value: unknown, values: Record<string, Value>): unknown {
  if (typeof value === "string") {
    if (/^\${{.+}}$/.test(value)) return values[value.slice(3, -2).trim()];
    return value.replace(/\${{(.+?)}}/g, (_, key) => String(values[key.trim()]));
  }
  if (Array.isArray(value)) return value.map((item) => applyMatrix(item, values));
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [key, applyMatrix(child, values)]),
    );
  return value;
}
