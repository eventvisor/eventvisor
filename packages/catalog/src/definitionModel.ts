export interface DefinitionRow {
  path: string;
  value: unknown;
}

export interface SchemaRow {
  path: string;
  type: string;
  schemaKey?: string;
  required?: boolean;
  description?: string;
  constraints: Array<{ label: string; value: unknown }>;
}

export interface DetailTabDefinition {
  to: string;
  label: string;
}

const schemaKeys = new Set([
  "schema",
  "const",
  "default",
  "additionalProperties",
  "description",
  "enum",
  "examples",
  "items",
  "maximum",
  "maxItems",
  "maxLength",
  "minimum",
  "minItems",
  "minLength",
  "pattern",
  "properties",
  "required",
  "type",
  "uniqueItems",
]);

const constraintLabels: Record<string, string> = {
  const: "const",
  default: "default",
  enum: "enum",
  examples: "examples",
  maximum: "max",
  maxItems: "max items",
  maxLength: "max length",
  minimum: "min",
  minItems: "min items",
  minLength: "min length",
  pattern: "pattern",
  uniqueItems: "unique",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function inferType(schema: Record<string, unknown>): string {
  if (typeof schema.schema === "string") return `schema:${schema.schema}`;
  if (typeof schema.type === "string") return schema.type;
  if (schema.properties) return "object";
  if (schema.items) return "array";
  if (Array.isArray(schema.enum) && schema.enum.length) {
    return [...new Set(schema.enum.map((value) => (value === null ? "null" : typeof value)))].join(
      " | ",
    );
  }
  return "any";
}

function getConstraints(schema: Record<string, unknown>) {
  return Object.entries(constraintLabels)
    .filter(([key]) => schema[key] !== undefined)
    .map(([key, label]) => ({ label, value: schema[key] }));
}

function appendSchemaRows(
  schema: Record<string, unknown>,
  path: string,
  required: boolean | undefined,
  rows: SchemaRow[],
) {
  rows.push({
    path: path || "$",
    type: inferType(schema),
    schemaKey: typeof schema.schema === "string" ? schema.schema : undefined,
    required,
    description: typeof schema.description === "string" ? schema.description : undefined,
    constraints: getConstraints(schema),
  });

  const requiredProperties = new Set(
    Array.isArray(schema.required)
      ? schema.required.filter((value): value is string => typeof value === "string")
      : [],
  );
  if (isRecord(schema.properties)) {
    Object.entries(schema.properties).forEach(([key, child]) => {
      if (!isRecord(child)) return;
      appendSchemaRows(child, path ? `${path}.${key}` : key, requiredProperties.has(key), rows);
    });
  }

  if (Array.isArray(schema.items)) {
    schema.items.forEach((item, index) => {
      if (isRecord(item)) appendSchemaRows(item, `${path || "$"}[${index}]`, undefined, rows);
    });
  } else if (isRecord(schema.items)) {
    appendSchemaRows(schema.items, `${path || "$"}[]`, undefined, rows);
  }
}

export function getSchemaRows(entity: Record<string, unknown>): SchemaRow[] {
  const rows: SchemaRow[] = [];
  appendSchemaRows(entity, "", undefined, rows);
  return rows;
}

export function getSchemaPresentation(entity: Record<string, unknown>) {
  const [root, ...rows] = getSchemaRows(entity);

  return {
    root,
    rows: rows.map((row) => ({
      ...row,
      path: row.path.startsWith("$") ? row.path.slice(1) || "[]" : row.path,
    })),
  };
}

export function hasStructuredSchema(entity: Record<string, unknown>) {
  const type = inferType(entity);
  return type === "object" || type === "array";
}

function appendDefinitionRows(value: unknown, path: string, rows: DefinitionRow[]) {
  if (Array.isArray(value)) {
    if (!value.length || value.every((item) => item === null || typeof item !== "object")) {
      rows.push({ path: path || "$", value });
      return;
    }
    value.forEach((item, index) => appendDefinitionRows(item, `${path}[${index}]`, rows));
    return;
  }
  if (isRecord(value)) {
    const entries = Object.entries(value);
    if (!entries.length) {
      rows.push({ path: path || "$", value });
      return;
    }
    entries.forEach(([key, child]) =>
      appendDefinitionRows(child, path ? `${path}.${key}` : key, rows),
    );
    return;
  }
  rows.push({ path: path || "$", value });
}

export function flattenDefinition(value: Record<string, unknown>): DefinitionRow[] {
  const rows: DefinitionRow[] = [];
  Object.entries(value).forEach(([key, child]) => appendDefinitionRows(child, key, rows));
  return rows;
}

export function flattenValue(value: unknown): DefinitionRow[] {
  const rows: DefinitionRow[] = [];
  appendDefinitionRows(value, "", rows);
  return rows;
}

function hasContent(value: unknown) {
  if (value === undefined || value === null) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value).length > 0;
  return true;
}

const commonFields = new Set([
  "archived",
  "deprecated",
  "description",
  "key",
  "lastModified",
  "tags",
  "targets",
  "effectiveSchema",
]);

const structuralFields = new Set(["destinations", "steps", "transforms"]);

const selectionFields = new Set([
  "tag",
  "tags",
  "includeEvents",
  "excludeEvents",
  "includeAttributes",
  "excludeAttributes",
  "includeDestinations",
  "excludeDestinations",
  "includeEffects",
  "excludeEffects",
  "pretty",
  "stringify",
  "revisionFromHash",
]);

const behaviorFields: Record<string, Set<string>> = {
  event: new Set(["conditions", "level", "requiredAttributes", "sample", "skipValidation"]),
  attribute: new Set(["persist"]),
  destination: new Set(["conditions", "sample", "transport"]),
  effect: new Set(["conditions", "on", "persist", "state"]),
  target: new Set(),
};

export function getDetailTabs(
  type: string,
  entity: Record<string, unknown>,
): DetailTabDefinition[] {
  const tabs: DetailTabDefinition[] = [{ to: ".", label: "Overview" }];

  const hasBehavior = Object.values(getBehaviorDefinition(type, entity)).some(hasContent);
  if (hasBehavior) tabs.push({ to: "behavior", label: "Behavior" });

  if (hasContent(entity.transforms)) tabs.push({ to: "transforms", label: "Transforms" });
  if (hasContent(entity.destinations)) tabs.push({ to: "destinations", label: "Destinations" });
  if (hasContent(entity.steps)) tabs.push({ to: "steps", label: "Steps" });
  if (type === "target") tabs.push({ to: "selection", label: "Selection" });

  tabs.push(
    { to: "tests", label: "Tests" },
    { to: "usage", label: "Usage" },
    { to: "history", label: "History" },
  );
  return tabs;
}

export function getBehaviorDefinition(type: string, entity: Record<string, unknown>) {
  const fields = behaviorFields[type] || new Set<string>();
  return Object.fromEntries(
    Object.entries(entity).filter(([key]) => {
      if (fields.has(key)) return !["level", "requiredAttributes", "transport"].includes(key);
      return (
        !commonFields.has(key) &&
        !schemaKeys.has(key) &&
        !structuralFields.has(key) &&
        !selectionFields.has(key)
      );
    }),
  );
}

export function getTargetSelectionDefinition(entity: Record<string, unknown>) {
  return {
    filters: Object.fromEntries(
      Object.entries(entity).filter(
        ([key]) =>
          key === "tag" || key === "tags" || key.startsWith("include") || key.startsWith("exclude"),
      ),
    ),
    output: Object.fromEntries(
      Object.entries(entity).filter(([key]) =>
        ["pretty", "stringify", "revisionFromHash"].includes(key),
      ),
    ),
  };
}
