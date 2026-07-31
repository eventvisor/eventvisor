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
import { assertProjectSetJsonSelection, getProjectSetExecutions, printSetHeader } from "../sets";
import { generateHashForDatafile } from "./hashes";
import { CLI_COLOR_CYAN, CLI_FORMAT_BOLD, CLI_FORMAT_GREEN, colorize } from "../tester/cliFormat";
import * as path from "path";
import { loadSchemas, resolveEntitySchema } from "../schemas";

export interface BuildCLIOptions {
  tag?: string | string[];
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

export interface BuildSelectedDatafileOptions {
  tag?: string | string[];
  target?: string | string[];
  revision?: string;
}

function optionValues(value?: string | string[]): string[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function mergeDatafiles(left: DatafileContent, right: DatafileContent): DatafileContent {
  return {
    ...left,
    attributes: { ...left.attributes, ...right.attributes },
    events: { ...left.events, ...right.events },
    destinations: { ...left.destinations, ...right.destinations },
    effects: { ...left.effects, ...right.effects },
  };
}

export async function buildSelectedDatafile(
  deps: Dependencies,
  options: BuildSelectedDatafileOptions = {},
): Promise<DatafileContent> {
  const tags = optionValues(options.tag);
  const targets = optionValues(options.target);
  const selections: BuildDatafileOptions[] = [];
  if (targets.length) {
    for (const target of targets) {
      if (tags.length)
        tags.forEach((tag) => selections.push({ target, tag, revision: options.revision }));
      else selections.push({ target, revision: options.revision });
    }
  } else if (tags.length) {
    tags.forEach((tag) => selections.push({ tag, revision: options.revision }));
  } else {
    selections.push({ revision: options.revision });
  }

  let result: DatafileContent | undefined;
  for (const selection of selections) {
    const datafile = await buildDatafile(deps, selection);
    result = result ? mergeDatafiles(result, datafile) : datafile;
  }
  return result as DatafileContent;
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

    // These fields contain user data or JSON Schema declarations. Keys such as
    // `attribute`, `effect`, and `source` inside them are literals, not runtime
    // references.
    if (
      ["value", "default", "examples", "const", "enum", "properties", "state", "params"].includes(
        key,
      )
    ) {
      continue;
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

function stripSchemaDescriptions(schema: any): any {
  if (!schema || typeof schema !== "object") return schema;
  const result = Array.isArray(schema) ? schema.map(stripSchemaDescriptions) : { ...schema };
  if (!Array.isArray(result)) {
    delete result.description;
    if (result.properties) {
      result.properties = Object.fromEntries(
        Object.entries(result.properties).map(([key, value]) => [
          key,
          stripSchemaDescriptions(value),
        ]),
      );
    }
    if (result.items) result.items = stripSchemaDescriptions(result.items);
  }
  return result;
}

function stripMetadata<T extends { description?: string; tags?: Tag[]; promotable?: boolean }>(
  entity: T,
): T {
  const result = stripSchemaDescriptions(entity);
  delete result.description;
  delete result.tags;
  delete result.promotable;
  if (Array.isArray(result.steps)) {
    result.steps = result.steps.map((step) => {
      const copy = { ...step };
      delete copy.description;
      return copy;
    });
  }
  return result;
}

function stringifyKnownConditions(type: keyof Entities, entity: any): unknown {
  const result = JSON.parse(JSON.stringify(entity));
  const stringify = (holder: any) => {
    if (holder?.conditions && typeof holder.conditions !== "string") {
      holder.conditions = JSON.stringify(holder.conditions);
    }
  };
  const transforms = (items: any) => (items || []).forEach(stringify);
  const samples = (items: any) =>
    (Array.isArray(items) ? items : items ? [items] : []).forEach(stringify);
  const persists = (items: any) =>
    (Array.isArray(items) ? items : items ? [items] : []).forEach((item) => {
      if (typeof item === "object") stringify(item);
    });

  if (type === "attributes") {
    transforms(result.transforms);
    persists(result.persist);
  } else if (type === "events") {
    stringify(result);
    stringify(result.skipValidation);
    samples(result.sample);
    transforms(result.transforms);
    Object.values(result.destinations || {}).forEach((override: any) => {
      if (!override || typeof override !== "object") return;
      stringify(override);
      samples(override.sample);
      transforms(override.transforms);
    });
  } else if (type === "destinations") {
    stringify(result);
    samples(result.sample);
    transforms(result.transforms);
  } else if (type === "effects") {
    stringify(result);
    persists(result.persist);
    (result.steps || []).forEach((step: any) => {
      stringify(step);
      transforms(step.transforms);
    });
  }
  return result;
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
  const schemas = await loadSchemas(datasource);
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
  const rootSelectedKeys = Object.fromEntries(
    Object.entries(selectedKeys).map(([type, keys]) => [type, new Set(keys)]),
  ) as Record<keyof Entities, Set<string>>;
  const unsatisfiedDependencies = new Set<string>();

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
      const validationPolicy = entities.events[eventName].onValidationFailure;
      if (typeof validationPolicy === "object" && validationPolicy.action === "quarantine") {
        references.destinations.add(validationPolicy.destination);
      }
      Object.keys(entities.events[eventName].destinations || {}).forEach((destinationName) =>
        references.destinations.add(destinationName),
      );
      for (const [effectName, effect] of Object.entries(entities.effects)) {
        if (effectListensTo(effect, "event_tracked", eventName)) references.effects.add(effectName);
      }
    });
    if (selectedKeys.events.size > 0) {
      const policy = deps.projectConfig.onValidationFailure;
      if (typeof policy === "object" && policy.action === "quarantine") {
        references.destinations.add(policy.destination);
      }
    }
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
        if (effect.on.includes("event_tracked") && rootSelectedKeys.effects.has(effectName)) {
          Object.keys(entities.events).forEach((eventName) => references.events.add(eventName));
        }
        if (effect.on.includes("attribute_set") && rootSelectedKeys.effects.has(effectName)) {
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
        if (isExplicitlyExcluded(type, key, target, fields)) {
          if (entities[type][key] && !entities[type][key].archived) {
            unsatisfiedDependencies.add(`${type.slice(0, -1)}:${key}`);
          }
        } else if (
          entities[type][key] &&
          !entities[type][key].archived &&
          !selectedKeys[type].has(key)
        ) {
          selectedKeys[type].add(key);
          changed = true;
        }
      });
    }
  }

  if (unsatisfiedDependencies.size > 0) {
    throw new Error(
      `Target "${options.target}" excludes required dependencies: ${[...unsatisfiedDependencies].sort().join(", ")}`,
    );
  }

  const datafile: DatafileContent = {
    schemaVersion: SCHEMA_VERSION,
    eventvisorVersion: getEventvisorVersion(),
    revision: options.revision || "1",
    onValidationFailure: deps.projectConfig.onValidationFailure,
    attributes: {},
    events: {},
    destinations: {},
    effects: {},
  };
  for (const type of Object.keys(entities) as (keyof Entities)[]) {
    selectedKeys[type].forEach((key) => {
      const authoredEntity = entities[type][key];
      const resolvedEntity =
        type === "attributes" || type === "events"
          ? resolveEntitySchema(authoredEntity, schemas)
          : authoredEntity;
      const entity = stripMetadata(resolvedEntity);
      (datafile[type] as Record<string, unknown>)[key] =
        (target?.stringify ?? deps.projectConfig.stringify)
          ? stringifyKnownConditions(type, entity)
          : entity;
    });
  }
  return datafile;
}

async function buildExecution(deps: Dependencies, options: BuildCLIOptions) {
  const { datasource } = deps;
  const currentRevision = await datasource.readRevision();
  const nextRevision = options.revision?.toString() || getNextRevision(currentRevision);

  if (options.json) {
    const targets = Array.isArray(options.target)
      ? options.target
      : options.target
        ? [options.target]
        : [];
    if (targets.length > 1) throw new Error("Pass only one --target when using --json.");
    const datafile = await buildSelectedDatafile(deps, {
      tag: options.tag,
      target: targets[0],
      revision: nextRevision,
    });
    if (options.revisionFromHash) datafile.revision = generateHashForDatafile(datafile);
    console.log(JSON.stringify(datafile, null, options.pretty ? 2 : undefined));
    return;
  }

  console.log("");
  console.log(CLI_FORMAT_BOLD, "Building Eventvisor datafiles");
  console.log(`  Current revision: ${currentRevision}`);
  const selectedTargets = Array.isArray(options.target)
    ? options.target
    : options.target
      ? [options.target]
      : [];
  const targets = selectedTargets.length ? selectedTargets : await datasource.listTargets();
  if (targets.length === 0) {
    throw new Error("No Targets found. Create at least one Target before building datafiles.");
  }
  for (const target of targets) {
    const definition = await datasource.readTarget(target);
    const datafile = await buildSelectedDatafile(deps, {
      tag: options.tag,
      target,
      revision: nextRevision,
    });
    if (options.revisionFromHash || definition.revisionFromHash) {
      datafile.revision = generateHashForDatafile(datafile);
    }
    console.log("");
    console.log(`  ${colorize("Target", CLI_COLOR_CYAN)}: ${target}`);
    await datasource.writeDatafile(datafile, {
      target,
      datafilesDir: options.datafilesDir,
      pretty: options.pretty ?? definition.pretty,
    });
  }
  await datasource.writeRevision(nextRevision);
  console.log("");
  console.log(CLI_FORMAT_GREEN, "Datafiles built");
  console.log(CLI_FORMAT_BOLD, `Latest revision: ${nextRevision}`);
}

export async function buildProject(deps: Dependencies, options: BuildCLIOptions = {}) {
  assertProjectSetJsonSelection(deps.projectConfig, options.set, options.json);
  const executions = await getProjectSetExecutions(
    deps.projectConfig,
    deps.datasource,
    options.set,
  );
  const currentRevision = await deps.datasource.readRevision();
  const nextRevision = options.revision?.toString() || getNextRevision(currentRevision);

  if (deps.projectConfig.sets && !options.json) {
    console.log("");
    console.log(CLI_FORMAT_BOLD, "Building Eventvisor sets");
    console.log(`  Sets: ${executions.map((execution) => execution.set).join(", ")}`);
    console.log(`  Current project revision: ${currentRevision}`);
  }

  for (const execution of executions) {
    printSetHeader(deps.projectConfig, execution.set, options.json);
    const executionOptions =
      deps.projectConfig.sets && options.datafilesDir
        ? { ...options, datafilesDir: path.join(options.datafilesDir, execution.set) }
        : options;
    await buildExecution(
      { ...deps, projectConfig: execution.projectConfig, datasource: execution.datasource },
      { ...executionOptions, revision: deps.projectConfig.sets ? nextRevision : options.revision },
    );
  }

  if (deps.projectConfig.sets && !options.json && !options.revision) {
    await deps.datasource.writeRevision(nextRevision);
    console.log("");
    console.log(CLI_FORMAT_GREEN, "Eventvisor sets built");
    console.log(CLI_FORMAT_BOLD, `Latest project revision: ${nextRevision}`);
  }
}

export const buildPlugin: Plugin = {
  command: "build",
  options: {
    tag: { type: "array", description: "filter selected Target content by one or more tags" },
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
