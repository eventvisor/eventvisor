import type { EntityType, Target, TargetPatterns } from "@eventvisor/types";
import type { Datasource } from "../datasource";
import { collectSchemaReferences } from "../schemas";

export interface EntityReference {
  type: EntityType;
  key: string;
}

export type DependencyGraph = Record<string, EntityReference[]>;

const entityTypes: EntityType[] = [
  "attribute",
  "event",
  "destination",
  "effect",
  "schema",
  "target",
  "test",
];

const runtimeTypes = ["attribute", "event", "destination", "effect"] as const;

export function entityId(type: EntityType, key: string) {
  return `${type}:${key}`;
}

export function matchesEntityPattern(value: string, patterns?: TargetPatterns): boolean {
  const list =
    typeof patterns === "undefined" ? ["*"] : Array.isArray(patterns) ? patterns : [patterns];
  return list.some((pattern) => {
    if (pattern === "*") return true;
    const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
    return new RegExp(`^${escaped}$`).test(value);
  });
}

function add(target: Set<string>, type: EntityType, value: unknown) {
  if (typeof value === "string" && value) target.add(entityId(type, value.split(".")[0]));
}

function collectRuntimeReferences(value: unknown, references: Set<string>) {
  if (Array.isArray(value)) {
    value.forEach((item) => collectRuntimeReferences(item, references));
    return;
  }
  if (!value || typeof value !== "object") return;

  for (const [field, child] of Object.entries(value as Record<string, unknown>)) {
    const values = Array.isArray(child) ? child : [child];
    if (field === "attribute") values.forEach((item) => add(references, "attribute", item));
    if (field === "effect") values.forEach((item) => add(references, "effect", item));
    if (field === "requiredAttributes") {
      values.forEach((item) => add(references, "attribute", item));
    }
    if (field === "source") {
      values.forEach((item) => {
        if (typeof item !== "string") return;
        const [origin, name] = item.split(".");
        if ((origin === "attribute" || origin === "attributes") && name) {
          add(references, "attribute", name);
        }
        if ((origin === "effect" || origin === "effects") && name) {
          add(references, "effect", name);
        }
      });
    }
    if (["value", "default", "examples", "const", "enum", "properties", "state"].includes(field)) {
      continue;
    }
    collectRuntimeReferences(child, references);
  }
}

function collectCollectionSources(
  value: unknown,
  entities: Record<EntityType, Record<string, Record<string, any>>>,
  references: Set<string>,
) {
  if (Array.isArray(value)) {
    value.forEach((item) => collectCollectionSources(item, entities, references));
    return;
  }
  if (!value || typeof value !== "object") return;

  for (const [field, child] of Object.entries(value as Record<string, unknown>)) {
    if (field === "source" && (child === "attributes" || child === "effects")) {
      const type = child === "attributes" ? "attribute" : "effect";
      Object.keys(entities[type]).forEach((key) => add(references, type, key));
    }
    collectCollectionSources(child, entities, references);
  }
}

export function getEntityReferences(
  type: EntityType,
  entity: Record<string, any>,
  entities: Record<EntityType, Record<string, Record<string, any>>>,
): EntityReference[] {
  const references = new Set<string>();
  collectRuntimeReferences(entity, references);
  collectCollectionSources(entity, entities, references);

  if (type === "event") {
    Object.keys(entity.destinations || {}).forEach((key) => add(references, "destination", key));
  }
  if (type === "effect") {
    if (Array.isArray(entity.on)) {
      if (entity.on.includes("event_tracked")) {
        Object.keys(entities.event).forEach((key) => add(references, "event", key));
      }
      if (entity.on.includes("attribute_set")) {
        Object.keys(entities.attribute).forEach((key) => add(references, "attribute", key));
      }
    } else {
      (entity.on?.event_tracked || []).forEach((key: string) => add(references, "event", key));
      (entity.on?.attribute_set || []).forEach((key: string) => add(references, "attribute", key));
    }
  }
  if (type === "attribute" || type === "event" || type === "schema") {
    collectSchemaReferences(entity).forEach((key) => add(references, "schema", key));
  }
  if (type === "test") {
    add(references, "event", entity.event);
    add(references, "attribute", entity.attribute);
    add(references, "destination", entity.destination);
    add(references, "effect", entity.effect);
    for (const assertion of entity.assertions || []) {
      for (const action of assertion.actions || []) {
        if (action.type === "track") add(references, "event", action.name);
        if (action.type === "setAttribute" || action.type === "removeAttribute") {
          add(references, "attribute", action.name);
        }
      }
    }
  }
  if (type === "target") {
    const target = entity as Target;
    for (const candidateType of runtimeTypes) {
      const singular = candidateType.charAt(0).toUpperCase() + candidateType.slice(1);
      const include = target[`include${singular}s` as keyof Target] as TargetPatterns | undefined;
      const exclude = target[`exclude${singular}s` as keyof Target] as TargetPatterns | undefined;
      for (const [key, candidate] of Object.entries(entities[candidateType])) {
        const tags = candidate.tags || [];
        const tagMatches = target.tag
          ? tags.includes(target.tag)
          : !target.tags ||
            (Array.isArray(target.tags)
              ? target.tags.some((tag) => tags.includes(tag))
              : "and" in target.tags
                ? target.tags.and.every((tag) => tags.includes(tag))
                : target.tags.or.some((tag) => tags.includes(tag)));
        if (
          tagMatches &&
          matchesEntityPattern(key, include) &&
          !(exclude && matchesEntityPattern(key, exclude))
        ) {
          add(references, candidateType, key);
        }
      }
    }
  }

  return [...references]
    .map((id) => {
      const separator = id.indexOf(":");
      return { type: id.slice(0, separator) as EntityType, key: id.slice(separator + 1) };
    })
    .filter((reference) => Boolean(entities[reference.type]?.[reference.key]))
    .sort((left, right) =>
      entityId(left.type, left.key).localeCompare(entityId(right.type, right.key)),
    );
}

export async function loadEntities(datasource: Datasource) {
  const entities = {} as Record<EntityType, Record<string, Record<string, any>>>;
  for (const type of entityTypes) {
    const list = `list${type.charAt(0).toUpperCase()}${type.slice(1)}s` as keyof Datasource;
    const read = `read${type.charAt(0).toUpperCase()}${type.slice(1)}` as keyof Datasource;
    entities[type] = {};
    for (const key of await (datasource[list] as () => Promise<string[]>)()) {
      entities[type][key] = await (
        datasource[read] as (key: string) => Promise<Record<string, any>>
      )(key);
    }
  }
  return entities;
}

export async function buildDependencyGraph(datasource: Datasource): Promise<DependencyGraph> {
  const entities = await loadEntities(datasource);
  const graph: DependencyGraph = {};
  for (const type of entityTypes) {
    for (const [key, entity] of Object.entries(entities[type])) {
      graph[entityId(type, key)] = getEntityReferences(type, entity, entities);
    }
  }
  return graph;
}

export function invertDependencyGraph(graph: DependencyGraph): DependencyGraph {
  const inverse: DependencyGraph = Object.fromEntries(Object.keys(graph).map((key) => [key, []]));
  for (const [source, references] of Object.entries(graph)) {
    const separator = source.indexOf(":");
    const sourceReference = {
      type: source.slice(0, separator) as EntityType,
      key: source.slice(separator + 1),
    };
    for (const reference of references) {
      (inverse[entityId(reference.type, reference.key)] ||= []).push(sourceReference);
    }
  }
  for (const references of Object.values(inverse)) {
    references.sort((left, right) =>
      entityId(left.type, left.key).localeCompare(entityId(right.type, right.key)),
    );
  }
  return inverse;
}
