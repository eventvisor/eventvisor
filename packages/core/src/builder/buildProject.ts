import type {
  Attribute,
  DatafileContent,
  Destination,
  Effect,
  Event,
  Tag,
  Target,
  TargetPatterns,
} from "@eventvisor/types";

import { SCHEMA_VERSION } from "../config/projectConfig";
import type { Dependencies } from "../dependencies";
import type { Plugin } from "../cli";
import { assertProjectSetJsonSelection, getProjectSetExecutions } from "../sets";
import { generateHashForDatafile } from "./hashes";

export interface BuildCLIOptions {
  tag?: string;
  target?: string | string[];
  set?: string;
  revision?: string;
  revisionFromHash?: boolean;
  json?: boolean;
  pretty?: boolean;
  systemFiles?: boolean;
  datafilesDir?: string;
}

export interface BuildDatafileOptions {
  tag?: string;
  target?: string;
  revision?: string;
}

type Entities = {
  attributes: Record<string, Attribute>;
  events: Record<string, Event>;
  destinations: Record<string, Destination>;
  effects: Record<string, Effect>;
};

export function getNextRevision(currentRevision: string) {
  if (!currentRevision || isNaN(parseInt(currentRevision, 10))) return "1";
  return (parseInt(currentRevision, 10) + 1).toString();
}

function getEventvisorVersion(): string {
  try {
    return require(require.resolve("@eventvisor/cli/package.json")).version;
  } catch {
    return "unknown";
  }
}

function toPatterns(value?: TargetPatterns): string[] {
  if (typeof value === "undefined") return ["*"];
  return Array.isArray(value) ? value : [value];
}

export function matchesPattern(value: string, patterns?: TargetPatterns): boolean {
  return toPatterns(patterns).some((pattern) => {
    if (pattern === "*") return true;
    const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
    return new RegExp(`^${escaped}$`).test(value);
  });
}

function matchesTags(entityTags: Tag[] | undefined, target: Target): boolean {
  const tags = entityTags || [];
  if (target.tag) return tags.includes(target.tag);
  if (!target.tags) return true;
  if (Array.isArray(target.tags)) return target.tags.some((tag) => tags.includes(tag));
  if ("and" in target.tags) return target.tags.and.every((tag) => tags.includes(tag));
  return target.tags.or.some((tag) => tags.includes(tag));
}

function selected(
  key: string,
  tags: Tag[] | undefined,
  include: TargetPatterns | undefined,
  exclude: TargetPatterns | undefined,
  target: Target | undefined,
  tag: string | undefined,
) {
  if (tag && !(tags || []).includes(tag)) return false;
  if (target && !matchesTags(tags, target)) return false;
  return matchesPattern(key, include) && !(exclude && matchesPattern(key, exclude));
}

function collectReferences(value: unknown, references: Record<string, Set<string>>) {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    value.forEach((item) => collectReferences(item, references));
    return;
  }

  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const children = Array.isArray(child) ? child : [child];
    if (key === "attribute" || key === "effect") {
      children.forEach((item) => {
        if (typeof item === "string") references[`${key}s`].add(item.split(".")[0]);
      });
    } else if (key === "requiredAttributes") {
      children.forEach((item) => {
        if (typeof item === "string") references.attributes.add(item);
      });
    } else if (key === "source") {
      children.forEach((item) => {
        if (typeof item !== "string") return;
        const [origin, name] = item.split(".");
        if (!name && (origin === "attributes" || origin === "effects")) {
          references[origin].add("*");
        } else if (name && (origin === "attribute" || origin === "attributes")) {
          references.attributes.add(name);
        } else if (name && (origin === "effect" || origin === "effects")) {
          references.effects.add(name);
        }
      });
    }
    collectReferences(child, references);
  }
}

function effectListensTo(effect: Effect, type: "event_tracked" | "attribute_set", key: string) {
  if (Array.isArray(effect.on)) return effect.on.includes(type);
  return (effect.on[type] || []).includes(key);
}

function isExplicitlyExcluded(
  type: keyof Entities,
  key: string,
  target: Target | undefined,
  fields: Record<keyof Entities, [keyof Target, keyof Target]>,
) {
  const patterns = target?.[fields[type][1]] as TargetPatterns | undefined;
  return patterns ? matchesPattern(key, patterns) : false;
}

async function readEntities(deps: Dependencies): Promise<Entities> {
  const { datasource } = deps;
  const [attributeKeys, eventKeys, destinationKeys, effectKeys] = await Promise.all([
    datasource.listAttributes(),
    datasource.listEvents(),
    datasource.listDestinations(),
    datasource.listEffects(),
  ]);
  const attributes = Object.fromEntries(
    await Promise.all(attributeKeys.map(async (key) => [key, await datasource.readAttribute(key)])),
  );
  const events = Object.fromEntries(
    await Promise.all(eventKeys.map(async (key) => [key, await datasource.readEvent(key)])),
  );
  const destinations = Object.fromEntries(
    await Promise.all(
      destinationKeys.map(async (key) => [key, await datasource.readDestination(key)]),
    ),
  );
  const effects = Object.fromEntries(
    await Promise.all(effectKeys.map(async (key) => [key, await datasource.readEffect(key)])),
  );
  return { attributes, events, destinations, effects } as Entities;
}

function stripMetadata<T extends { description?: string; tags?: Tag[] }>(entity: T): T {
  const result = { ...entity };
  delete result.description;
  delete result.tags;
  return result;
}

function stringifyConditions(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stringifyConditions);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, child]) => [
      key,
      key === "conditions" && typeof child !== "string"
        ? JSON.stringify(child)
        : stringifyConditions(child),
    ]),
  );
}

export async function buildDatafile(
  deps: Dependencies,
  options: BuildDatafileOptions = {},
): Promise<DatafileContent> {
  const { datasource } = deps;
  if (options.tag && !deps.projectConfig.tags.includes(options.tag)) {
    throw new Error(
      `Unknown tag "${options.tag}". Available tags: ${deps.projectConfig.tags.join(", ")}.`,
    );
  }
  if (options.target && !(await datasource.targetExists(options.target))) {
    throw new Error(`Unknown target "${options.target}".`);
  }
  const entities = await readEntities(deps);
  const target = options.target ? await datasource.readTarget(options.target) : undefined;

  const selectedKeys: Record<keyof Entities, Set<string>> = {
    attributes: new Set(),
    events: new Set(),
    destinations: new Set(),
    effects: new Set(),
  };
  const fields: Record<keyof Entities, [keyof Target, keyof Target]> = {
    attributes: ["includeAttributes", "excludeAttributes"],
    events: ["includeEvents", "excludeEvents"],
    destinations: ["includeDestinations", "excludeDestinations"],
    effects: ["includeEffects", "excludeEffects"],
  };

  for (const type of Object.keys(entities) as (keyof Entities)[]) {
    const [includeField, excludeField] = fields[type];
    for (const [key, entity] of Object.entries(entities[type])) {
      if (!entity || entity.archived) continue;
      if (
        selected(
          key,
          entity.tags,
          target?.[includeField] as TargetPatterns | undefined,
          target?.[excludeField] as TargetPatterns | undefined,
          target,
          options.tag,
        )
      ) {
        selectedKeys[type].add(key);
      }
    }
  }

  // Include definitions referenced by selected entities. Explicit exclusions still win.
  let changed = true;
  while (changed) {
    changed = false;
    const references = {
      attributes: new Set<string>(),
      events: new Set<string>(),
      destinations: new Set<string>(),
      effects: new Set<string>(),
    };
    for (const type of Object.keys(entities) as (keyof Entities)[]) {
      selectedKeys[type].forEach((key) => collectReferences(entities[type][key], references));
    }

    for (const type of ["attributes", "effects"] as const) {
      if (references[type].delete("*")) {
        Object.keys(entities[type]).forEach((key) => references[type].add(key));
      }
    }

    selectedKeys.events.forEach((eventName) => {
      Object.keys(entities.events[eventName].destinations || {}).forEach((destinationName) =>
        references.destinations.add(destinationName),
      );
      for (const [effectName, effect] of Object.entries(entities.effects)) {
        if (effectListensTo(effect, "event_tracked", eventName)) references.effects.add(effectName);
      }
    });
    selectedKeys.attributes.forEach((attributeName) => {
      for (const [effectName, effect] of Object.entries(entities.effects)) {
        if (effectListensTo(effect, "attribute_set", attributeName))
          references.effects.add(effectName);
      }
    });

    selectedKeys.effects.forEach((effectName) => {
      const effect = entities.effects[effectName];
      if (!effect || effect.archived) return;
      if (Array.isArray(effect.on)) {
        if (effect.on.includes("event_tracked")) {
          Object.keys(entities.events).forEach((eventName) => references.events.add(eventName));
        }
        if (effect.on.includes("attribute_set")) {
          Object.keys(entities.attributes).forEach((attributeName) =>
            references.attributes.add(attributeName),
          );
        }
        return;
      }
      for (const eventName of effect.on.event_tracked || []) references.events.add(eventName);
      for (const attributeName of effect.on.attribute_set || []) {
        references.attributes.add(attributeName);
      }
    });

    for (const type of ["attributes", "events", "destinations", "effects"] as const) {
      references[type].forEach((key) => {
        if (
          entities[type][key] &&
          !entities[type][key].archived &&
          !selectedKeys[type].has(key) &&
          !isExplicitlyExcluded(type, key, target, fields)
        ) {
          selectedKeys[type].add(key);
          changed = true;
        }
      });
    }
  }

  const datafile: DatafileContent = {
    schemaVersion: SCHEMA_VERSION,
    eventvisorVersion: getEventvisorVersion(),
    revision: options.revision || "1",
    attributes: {},
    events: {},
    destinations: {},
    effects: {},
  };
  for (const type of Object.keys(entities) as (keyof Entities)[]) {
    selectedKeys[type].forEach((key) => {
      const entity = stripMetadata(entities[type][key]);
      (datafile[type] as Record<string, unknown>)[key] =
        (target?.stringify ?? deps.projectConfig.stringify) ? stringifyConditions(entity) : entity;
    });
  }
  return datafile;
}

async function buildExecution(deps: Dependencies, options: BuildCLIOptions) {
  const { projectConfig, datasource } = deps;
  const currentRevision = await datasource.readRevision();
  const nextRevision = options.revision?.toString() || getNextRevision(currentRevision);

  if (options.json) {
    const targets = Array.isArray(options.target)
      ? options.target
      : options.target
        ? [options.target]
        : [];
    if (targets.length > 1) throw new Error("Pass only one --target when using --json.");
    const datafile = await buildDatafile(deps, {
      tag: options.tag,
      target: targets[0],
      revision: nextRevision,
    });
    if (options.revisionFromHash) datafile.revision = generateHashForDatafile(datafile);
    console.log(JSON.stringify(datafile, null, options.pretty ? 2 : undefined));
    return;
  }

  console.log("\nCurrent revision:", currentRevision);
  const selectedTargets = Array.isArray(options.target)
    ? options.target
    : options.target
      ? [options.target]
      : [];
  const tags = selectedTargets.length ? [] : options.tag ? [options.tag] : projectConfig.tags;
  for (const tag of tags) {
    const datafile = await buildDatafile(deps, { tag, revision: nextRevision });
    if (options.revisionFromHash) datafile.revision = generateHashForDatafile(datafile);
    console.log(`\n  => Tag: ${tag}`);
    await datasource.writeDatafile(datafile, {
      tag,
      datafilesDir: options.datafilesDir,
      pretty: options.pretty,
    });
  }
  const targets = selectedTargets.length
    ? selectedTargets
    : options.tag
      ? []
      : await datasource.listTargets();
  for (const target of targets) {
    const definition = await datasource.readTarget(target);
    const datafile = await buildDatafile(deps, {
      tag: options.tag,
      target,
      revision: nextRevision,
    });
    if (options.revisionFromHash || definition.revisionFromHash) {
      datafile.revision = generateHashForDatafile(datafile);
    }
    console.log(`\n  => Target: ${target}`);
    await datasource.writeDatafile(datafile, {
      target,
      datafilesDir: options.datafilesDir,
      pretty: options.pretty ?? definition.pretty,
    });
  }
  await datasource.writeRevision(nextRevision);
  console.log("\nLatest revision:", nextRevision, "\n");
}

export async function buildProject(deps: Dependencies, options: BuildCLIOptions = {}) {
  assertProjectSetJsonSelection(deps.projectConfig, options.set, options.json);
  const executions = await getProjectSetExecutions(
    deps.projectConfig,
    deps.datasource,
    options.set,
  );
  for (const execution of executions) {
    await buildExecution(
      { ...deps, projectConfig: execution.projectConfig, datasource: execution.datasource },
      options,
    );
  }
}

export const buildPlugin: Plugin = {
  command: "build",
  options: {
    tag: { type: "string", description: "build JSON for a tag" },
    target: { type: "array", description: "build one or more targets" },
    set: { type: "string", description: "build a project set" },
    json: { type: "boolean", description: "print the datafile as JSON" },
    pretty: { type: "boolean", description: "pretty print JSON" },
    revision: { type: "string" },
    revisionFromHash: { type: "boolean" },
    datafilesDir: { type: "string" },
  },
  handler: async ({ rootDirectoryPath, projectConfig, datasource, parsed }) =>
    buildProject(
      { rootDirectoryPath, projectConfig, datasource, options: parsed },
      parsed as BuildCLIOptions,
    ),
  examples: [],
};
