export interface ConditionSourcePresentation {
  label: string;
  value: unknown;
}

export interface ConditionLeafPresentation {
  kind: "leaf";
  source: ConditionSourcePresentation;
  operator: string;
  operatorLabel: string;
  value?: unknown;
  regexFlags?: string;
}

export interface ConditionGroupPresentation {
  kind: "group";
  mode: "all" | "any" | "notAll";
  label: string;
  description: string;
  children: ConditionPresentation[];
}

export interface ConditionMessagePresentation {
  kind: "always" | "unknown";
  label: string;
}

export type ConditionPresentation =
  ConditionLeafPresentation | ConditionGroupPresentation | ConditionMessagePresentation;

const sourceLabels: Record<string, string> = {
  source: "Input",
  attribute: "Attribute",
  state: "State",
  effect: "Effect",
  payload: "Payload",
  lookup: "Lookup",
};

const operatorLabels: Record<string, string> = {
  equals: "equals",
  notEquals: "does not equal",
  exists: "exists",
  notExists: "does not exist",
  greaterThan: "is greater than",
  greaterThanOrEquals: "is at least",
  lessThan: "is less than",
  lessThanOrEquals: "is at most",
  contains: "contains",
  notContains: "does not contain",
  startsWith: "starts with",
  endsWith: "ends with",
  semverEquals: "has version equal to",
  semverNotEquals: "has version different from",
  semverGreaterThan: "has version greater than",
  semverGreaterThanOrEquals: "has version at least",
  semverLessThan: "has version less than",
  semverLessThanOrEquals: "has version at most",
  before: "is before",
  after: "is after",
  includes: "includes",
  notIncludes: "does not include",
  matches: "matches",
  notMatches: "does not match",
  in: "is one of",
  notIn: "is not one of",
};

const groupCopy = {
  all: {
    label: "All",
    description: "Every condition below must match",
  },
  any: {
    label: "Any",
    description: "At least one condition below must match",
  },
  notAll: {
    label: "Not all",
    description: "The complete group below must not match",
  },
} as const;

function getSource(condition: Record<string, unknown>): ConditionSourcePresentation {
  for (const [key, label] of Object.entries(sourceLabels)) {
    if (Object.prototype.hasOwnProperty.call(condition, key)) {
      return { label, value: condition[key] };
    }
  }

  return { label: "Input", value: "Unknown" };
}

function group(
  mode: ConditionGroupPresentation["mode"],
  values: unknown[],
): ConditionGroupPresentation {
  return {
    kind: "group",
    mode,
    ...groupCopy[mode],
    children: values.map(getConditionPresentation),
  };
}

export function getConditionPresentation(value: unknown): ConditionPresentation {
  if (value === "*") return { kind: "always", label: "Always" };

  if (typeof value === "string") {
    try {
      return getConditionPresentation(JSON.parse(value));
    } catch {
      return { kind: "unknown", label: "Condition could not be displayed" };
    }
  }

  if (Array.isArray(value)) {
    if (value.length === 1) return getConditionPresentation(value[0]);
    return group("all", value);
  }

  if (!value || typeof value !== "object") {
    return { kind: "unknown", label: "Condition could not be displayed" };
  }

  const condition = value as Record<string, unknown>;
  if (Array.isArray(condition.and)) return group("all", condition.and);
  if (Array.isArray(condition.or)) return group("any", condition.or);
  if (Array.isArray(condition.not)) return group("notAll", condition.not);

  const operator = typeof condition.operator === "string" ? condition.operator : "unknown";
  return {
    kind: "leaf",
    source: getSource(condition),
    operator,
    operatorLabel: operatorLabels[operator] || operator,
    ...(Object.prototype.hasOwnProperty.call(condition, "value") ? { value: condition.value } : {}),
    ...(typeof condition.regexFlags === "string" ? { regexFlags: condition.regexFlags } : {}),
  };
}
