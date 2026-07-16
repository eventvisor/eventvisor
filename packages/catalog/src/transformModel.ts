export interface TransformFlowValue {
  label: string;
  value?: unknown;
}

export interface TransformMapping {
  from: string;
  to: string;
}

export interface TransformPresentation {
  type: string;
  operation: string;
  summary: string;
  input: TransformFlowValue;
  output: TransformFlowValue;
  details: Array<{ label: string; value: unknown }>;
  mappings: TransformMapping[];
  conditions?: unknown;
}

const sourceLabels: Record<string, string> = {
  source: "Source",
  attribute: "Attribute",
  state: "Effect state",
  effect: "Effect",
  payload: "Payload",
  lookup: "Lookup",
};

const operationLabels: Record<string, string> = {
  set: "Set value",
  remove: "Remove value",
  rename: "Rename paths",
  trim: "Trim whitespace",
  toInteger: "Convert to integer",
  toDouble: "Convert to number",
  toString: "Convert to string",
  toBoolean: "Convert to boolean",
  concat: "Join values",
  spread: "Merge objects",
  append: "Append value",
  increment: "Increase number",
  decrement: "Decrease number",
};

function hasOwn(value: Record<string, unknown>, key: string) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function getExplicitSource(transform: Record<string, unknown>): TransformFlowValue | undefined {
  for (const key of Object.keys(sourceLabels)) {
    if (hasOwn(transform, key)) return { label: sourceLabels[key], value: transform[key] };
  }
}

function getMappings(value: unknown): TransformMapping[] {
  const maps = Array.isArray(value) ? value : value && typeof value === "object" ? [value] : [];
  return maps.flatMap((map) =>
    Object.entries(map as Record<string, unknown>)
      .filter((entry): entry is [string, string] => typeof entry[1] === "string")
      .map(([from, to]) => ({ from, to })),
  );
}

function getInput(transform: Record<string, unknown>, type: string): TransformFlowValue {
  if (type === "set" && hasOwn(transform, "value")) {
    return { label: "Literal value", value: transform.value };
  }

  const source = getExplicitSource(transform);
  if (source) return source;

  if (["append", "spread"].includes(type) && hasOwn(transform, "value")) {
    return { label: "Literal value", value: transform.value };
  }

  if (typeof transform.target === "string") {
    return { label: "Current value at", value: transform.target };
  }

  return { label: "Current value" };
}

function getOutput(
  transform: Record<string, unknown>,
  type: string,
  mappings: TransformMapping[],
): TransformFlowValue {
  if (type === "rename") {
    return { label: mappings.length === 1 ? "Renamed path" : "Renamed paths" };
  }
  if (type === "remove") return { label: "Removed from", value: transform.target };
  if (typeof transform.target === "string") return { label: "Write to", value: transform.target };
  return { label: type === "set" ? "Replace entire value" : "Updated entire value" };
}

function getSummary(
  transform: Record<string, unknown>,
  type: string,
  mappings: TransformMapping[],
) {
  const target = typeof transform.target === "string" ? ` “${transform.target}”` : "";
  if (type === "set") return target ? `Write a value to${target}` : "Replace the entire value";
  if (type === "remove") return `Remove${target}`;
  if (type === "rename")
    return `Rename ${mappings.length} ${mappings.length === 1 ? "path" : "paths"}`;
  if (type === "spread") return target ? `Merge into${target}` : "Merge into the entire value";
  if (type === "append") return target ? `Append to${target}` : "Append to the entire value";
  if (type === "increment") return target ? `Increase${target}` : "Increase the entire value";
  if (type === "decrement") return target ? `Decrease${target}` : "Decrease the entire value";
  if (type === "concat") return `Join values into${target}`;
  if (type === "trim") return `Trim whitespace at${target}`;
  if (type === "toInteger") return `Convert${target} to an integer`;
  if (type === "toDouble") return `Convert${target} to a number`;
  if (type === "toString") return `Convert${target} to a string`;
  if (type === "toBoolean") return `Convert${target} to a boolean`;
  return target ? `${operationLabels[type] || type}${target}` : operationLabels[type] || type;
}

export function getTransformPresentation(value: unknown): TransformPresentation {
  const transform =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const type = typeof transform.type === "string" ? transform.type : "unknown";
  const mappings = getMappings(transform.targetMap);
  const details: Array<{ label: string; value: unknown }> = [];

  if (type === "concat") details.push({ label: "Separator", value: transform.separator ?? " " });
  if (type === "increment" || type === "decrement") {
    details.push({
      label: "Amount",
      value: typeof transform.value === "number" ? transform.value : 1,
    });
  }
  const source = getExplicitSource(transform);
  if (source && hasOwn(transform, "value") && !["set", "increment", "decrement"].includes(type)) {
    details.push({ label: "Fallback", value: transform.value });
  }

  return {
    type,
    operation: operationLabels[type] || type,
    summary: getSummary(transform, type, mappings),
    input: getInput(transform, type),
    output: getOutput(transform, type, mappings),
    details,
    mappings,
    conditions: transform.conditions,
  };
}
