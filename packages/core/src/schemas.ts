import type { JSONSchema, Schema } from "@eventvisor/types";
import type { Datasource } from "./datasource";

const schemaFields = new Set([
  "schema",
  "description",
  "type",
  "enum",
  "const",
  "maximum",
  "minimum",
  "maxLength",
  "minLength",
  "pattern",
  "items",
  "maxItems",
  "minItems",
  "uniqueItems",
  "required",
  "properties",
  "default",
  "examples",
]);

export async function loadSchemas(datasource: Datasource): Promise<Record<string, Schema>> {
  const keys = await datasource.listSchemas();
  return Object.fromEntries(
    await Promise.all(keys.map(async (key) => [key, await datasource.readSchema(key)])),
  );
}

function resolveNode(
  node: JSONSchema,
  schemas: Record<string, Schema>,
  trail: string[],
): JSONSchema {
  let merged: JSONSchema = { ...node };

  if (node.schema) {
    const key = node.schema;
    const referenced = schemas[key];
    if (!referenced) throw new Error(`Reusable schema "${key}" does not exist.`);
    if (trail.includes(key)) {
      throw new Error(`Circular reusable schema reference: ${[...trail, key].join(" -> ")}.`);
    }
    const overlay = { ...node };
    delete overlay.schema;
    merged = { ...resolveNode(referenced, schemas, [...trail, key]), ...overlay };
  }

  if (merged.properties) {
    merged.properties = Object.fromEntries(
      Object.entries(merged.properties).map(([key, child]) => [
        key,
        resolveNode(child, schemas, trail),
      ]),
    );
  }
  if (Array.isArray(merged.items)) {
    merged.items = merged.items.map((item) => resolveNode(item, schemas, trail));
  } else if (merged.items) {
    merged.items = resolveNode(merged.items, schemas, trail);
  }

  delete merged.schema;
  return merged;
}

export function resolveSchema(schema: Schema, schemas: Record<string, Schema>): Schema {
  return resolveNode(schema, schemas, []);
}

export function resolveEntitySchema<T extends Record<string, any>>(
  entity: T,
  schemas: Record<string, Schema>,
): T {
  const schema = Object.fromEntries(
    Object.entries(entity).filter(([key]) => schemaFields.has(key)),
  ) as JSONSchema;
  const runtime = Object.fromEntries(
    Object.entries(entity).filter(([key]) => !schemaFields.has(key)),
  );
  return { ...resolveNode(schema, schemas, []), ...runtime } as T;
}

function collectNodeReferences(node: JSONSchema, references: Set<string>) {
  if (node.schema) references.add(node.schema);
  Object.values(node.properties || {}).forEach((child) => collectNodeReferences(child, references));
  if (Array.isArray(node.items)) {
    node.items.forEach((item) => collectNodeReferences(item, references));
  } else if (node.items) {
    collectNodeReferences(node.items, references);
  }
}

export function collectSchemaReferences(entity: Record<string, any>): string[] {
  const schema = Object.fromEntries(
    Object.entries(entity).filter(([key]) => schemaFields.has(key)),
  ) as JSONSchema;
  const references = new Set<string>();
  collectNodeReferences(schema, references);
  return [...references];
}
