import * as fs from "fs";
import * as path from "path";
import type { EntityType } from "@eventvisor/types";
import type { Plugin } from "../cli";
import type { Dependencies } from "../dependencies";
import type { Datasource } from "../datasource";
import { lintProject } from "../linter/lintProject";
import {
  buildDependencyGraph,
  entityId,
  invertDependencyGraph,
  matchesEntityPattern,
} from "../utils/dependencyGraph";
import {
  CLI_COLOR_CYAN,
  CLI_COLOR_GREEN,
  CLI_COLOR_YELLOW,
  CLI_FORMAT_BOLD,
  colorize,
} from "../tester/cliFormat";

type ConflictPolicy = "source" | "destination" | "fail";
const entityTypes: EntityType[] = [
  "attribute",
  "event",
  "destination",
  "effect",
  "schema",
  "target",
  "test",
];

export interface PromoteOptions {
  from?: string;
  to?: string;
  includeEvents?: string | string[];
  excludeEvents?: string | string[];
  target?: string | string[];
  tag?: string | string[];
  conflicts?: ConflictPolicy;
  allowEmpty?: boolean;
  apply?: boolean;
  audit?: boolean;
  showUnchanged?: boolean;
}

interface PlannedEntity {
  type: EntityType;
  key: string;
  source: Record<string, any>;
  destination?: Record<string, any>;
  merged: Record<string, any>;
  conflicts: string[];
}

function toArray(value?: string | string[]) {
  return typeof value === "undefined" ? [] : Array.isArray(value) ? value : [value];
}

function isObject(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function equal(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function merge(
  destination: unknown,
  source: unknown,
  policy: ConflictPolicy,
  conflicts: string[],
  at = "<root>",
): unknown {
  if (typeof destination === "undefined") return source;
  if (typeof source === "undefined") return destination;
  if (isObject(destination) && isObject(source)) {
    const result = { ...destination };
    for (const [key, value] of Object.entries(source)) {
      result[key] = merge(
        destination[key],
        value,
        policy,
        conflicts,
        at === "<root>" ? key : `${at}.${key}`,
      );
    }
    return result;
  }
  if (!equal(destination, source)) conflicts.push(at);
  return policy === "destination" ? destination : source;
}

function method(type: EntityType, operation: "list" | "read" | "write" | "delete" | "exists") {
  return `${operation}${type.charAt(0).toUpperCase()}${type.slice(1)}${operation === "list" ? "s" : ""}` as keyof Datasource;
}

async function list(datasource: Datasource, type: EntityType) {
  return (datasource[method(type, "list")] as () => Promise<string[]>)();
}

async function read(datasource: Datasource, type: EntityType, key: string) {
  return (datasource[method(type, "read")] as (key: string) => Promise<Record<string, any>>)(key);
}

async function exists(datasource: Datasource, type: EntityType, key: string) {
  const fn = datasource[method(type, "exists")] as ((key: string) => Promise<boolean>) | undefined;
  return fn ? fn.call(datasource, key) : (await list(datasource, type)).includes(key);
}

async function write(
  datasource: Datasource,
  type: EntityType,
  key: string,
  value: Record<string, any>,
) {
  return (
    datasource[method(type, "write")] as (
      key: string,
      value: Record<string, any>,
    ) => Promise<unknown>
  )(key, value);
}

async function remove(datasource: Datasource, type: EntityType, key: string) {
  return (datasource[method(type, "delete")] as (key: string) => Promise<void>)(key);
}

function assertFlow(deps: Dependencies, from: string, to: string) {
  if (!deps.projectConfig.sets) throw new Error("Promotion requires sets: true.");
  if (from === to) throw new Error("Source and destination sets must be different.");
  const flows = deps.projectConfig.promotionFlows;
  if (flows && !flows.some((flow) => flow.from === from && flow.to === to)) {
    throw new Error(`Promotion from "${from}" to "${to}" is not allowed by promotionFlows.`);
  }
}

async function selectEntities(source: Datasource, options: PromoteOptions) {
  const graph = await buildDependencyGraph(source);
  const inverse = invertDependencyGraph(graph);
  const selected = new Set<string>();
  const includeEvents = toArray(options.includeEvents);
  const excludeEvents = toArray(options.excludeEvents);
  const tags = toArray(options.tag);
  const targets = toArray(options.target);
  const hasFilters = includeEvents.length || excludeEvents.length || tags.length || targets.length;

  for (const type of entityTypes) {
    for (const key of await list(source, type)) {
      const entity = await read(source, type, key);
      if (!hasFilters) selected.add(entityId(type, key));
      if (
        type === "event" &&
        (includeEvents.length === 0 ||
          includeEvents.some((pattern) => matchesEntityPattern(key, pattern))) &&
        excludeEvents.length > 0 &&
        !excludeEvents.some((pattern) => matchesEntityPattern(key, pattern))
      ) {
        selected.add(entityId(type, key));
      }
      if (
        type === "event" &&
        includeEvents.length > 0 &&
        excludeEvents.length === 0 &&
        includeEvents.some((pattern) => matchesEntityPattern(key, pattern))
      ) {
        selected.add(entityId(type, key));
      }
      if (tags.some((tag) => (entity.tags || []).includes(tag))) selected.add(entityId(type, key));
      if (type === "target" && targets.some((pattern) => matchesEntityPattern(key, pattern))) {
        selected.add(entityId(type, key));
      }
    }
  }

  const queue = [...selected];
  while (queue.length) {
    const current = queue.shift() as string;
    for (const reference of graph[current] || []) {
      const id = entityId(reference.type, reference.key);
      if (selected.has(id)) continue;
      selected.add(id);
      queue.push(id);
    }
  }

  // Effects listening to a selected event or attribute are part of its runtime behavior. The graph
  // points from an effect to its trigger, so include these reverse edges explicitly.
  for (const id of [...selected]) {
    if (!id.startsWith("event:") && !id.startsWith("attribute:")) continue;
    for (const dependent of inverse[id] || []) {
      if (dependent.type !== "effect") continue;
      const effectId = entityId(dependent.type, dependent.key);
      if (!selected.has(effectId)) {
        selected.add(effectId);
        queue.push(effectId);
      }
    }
  }
  while (queue.length) {
    const current = queue.shift() as string;
    for (const reference of graph[current] || []) {
      const id = entityId(reference.type, reference.key);
      if (selected.has(id)) continue;
      selected.add(id);
      queue.push(id);
    }
  }

  // Tests describe the selected contract rather than being runtime dependencies of it. Include
  // tests that point at anything in the promotion plan, then include the tests' own dependencies.
  for (const [id, references] of Object.entries(graph)) {
    if (!id.startsWith("test:") || selected.has(id)) continue;
    if (references.some((reference) => selected.has(entityId(reference.type, reference.key)))) {
      selected.add(id);
      queue.push(id);
    }
  }
  while (queue.length) {
    const current = queue.shift() as string;
    for (const reference of graph[current] || []) {
      const id = entityId(reference.type, reference.key);
      if (selected.has(id)) continue;
      selected.add(id);
      queue.push(id);
    }
  }
  return selected;
}

export async function promoteProjectSets(deps: Dependencies, options: PromoteOptions) {
  const from = options.from || "";
  const to = options.to || "";
  if (!from || !to) throw new Error("Pass both --from and --to.");
  assertFlow(deps, from, to);
  const sets = await deps.datasource.listSets();
  if (!sets.includes(from) || !sets.includes(to))
    throw new Error(`Unknown set. Available sets: ${sets.join(", ")}.`);
  const source = deps.datasource.forSet(from);
  const destination = deps.datasource.forSet(to);
  const selected = await selectEntities(source, options);
  if (!selected.size && !options.allowEmpty)
    throw new Error("No source entities matched the promotion filters.");
  const policy = options.conflicts || "source";
  if (!(["source", "destination", "fail"] as string[]).includes(policy)) {
    throw new Error('Invalid --conflicts. Use "source", "destination", or "fail".');
  }
  const plan: PlannedEntity[] = [];

  for (const id of [...selected].sort()) {
    const separator = id.indexOf(":");
    const type = id.slice(0, separator) as EntityType;
    const key = id.slice(separator + 1);
    const sourceValue = await read(source, type, key);
    const destinationValue = (await exists(destination, type, key))
      ? await read(destination, type, key)
      : undefined;
    const conflicts: string[] = [];
    const updateProtected =
      Boolean(destinationValue) &&
      (sourceValue.promotable === false || destinationValue?.promotable === false);
    const merged = updateProtected
      ? (destinationValue as Record<string, any>)
      : (merge(destinationValue, sourceValue, policy, conflicts) as Record<string, any>);
    plan.push({ type, key, source: sourceValue, destination: destinationValue, merged, conflicts });
  }
  const conflicts = plan.flatMap((item) =>
    item.conflicts.map((at) => `${entityId(item.type, item.key)}:${at}`),
  );
  if (policy === "fail" && conflicts.length)
    throw new Error(`Promotion conflicts:\n${conflicts.join("\n")}`);

  const changed = plan.filter((item) => !equal(item.destination, item.merged));
  console.log("");
  console.log(
    CLI_FORMAT_BOLD,
    `${options.apply ? "Applying" : "Previewing"} promotion ${from} → ${to}`,
  );
  console.log("");
  for (const item of plan) {
    const didChange = !equal(item.destination, item.merged);
    if (didChange || options.showUnchanged) {
      console.log(
        `  ${colorize(didChange ? "●" : "○", didChange ? CLI_COLOR_GREEN : CLI_COLOR_CYAN)} ${item.type}: ${item.key}${item.conflicts.length ? colorize(` (${item.conflicts.length} conflicts)`, CLI_COLOR_YELLOW) : ""}`,
      );
    }
  }

  if (options.apply) {
    const applied: PlannedEntity[] = [];
    try {
      for (const item of changed) {
        await write(destination, item.type, item.key, item.merged);
        applied.push(item);
      }
      const valid = await lintProject({
        ...deps,
        projectConfig: destination.getConfig(),
        datasource: destination,
      });
      if (!valid) throw new Error("Promoted destination set did not pass linting.");
    } catch (error) {
      for (const item of applied.reverse()) {
        if (item.destination) await write(destination, item.type, item.key, item.destination);
        else await remove(destination, item.type, item.key);
      }
      throw error;
    }
  }

  let auditFilePath: string | undefined;
  if (options.audit) {
    const directory = path.join(deps.projectConfig.systemDirectoryPath, "promotions");
    fs.mkdirSync(directory, { recursive: true });
    auditFilePath = path.join(directory, `${Date.now()}-${from}-to-${to}.json`);
    fs.writeFileSync(
      auditFilePath,
      JSON.stringify(
        {
          from,
          to,
          applied: Boolean(options.apply),
          entities: plan.map(({ type, key, conflicts }) => ({ type, key, conflicts })),
        },
        null,
        2,
      ),
    );
  }
  console.log("");
  console.log(
    `  ${changed.length} changed, ${plan.length - changed.length} unchanged${options.apply ? "" : ". Pass --apply to write files"}.`,
  );
  console.log("");
  return {
    from,
    to,
    apply: Boolean(options.apply),
    changed: changed.length,
    unchanged: plan.length - changed.length,
    conflicts,
    auditFilePath,
  };
}

export const promotePlugin: Plugin = {
  command: "promote",
  description: "preview or apply a Set promotion",
  options: {
    from: { type: "string", description: "source set", demandOption: true },
    to: { type: "string", description: "destination set", demandOption: true },
    includeEvents: { type: "array", description: "include event key patterns" },
    excludeEvents: { type: "array", description: "exclude event key patterns" },
    target: { type: "array", description: "include Targets and their dependencies" },
    tag: { type: "array", description: "include tagged entities" },
    conflicts: { type: "string", description: "source, destination, or fail" },
    allowEmpty: { type: "boolean" },
    apply: { type: "boolean", description: "write the destination files" },
    audit: { type: "boolean", description: "write a JSON audit record" },
    showUnchanged: { type: "boolean" },
  },
  handler: async (options) =>
    promoteProjectSets(
      { ...options, options: options.parsed },
      options.parsed as PromoteOptions,
    ).then(() => undefined),
  examples: [
    { command: "promote --from=development --to=staging", description: "preview a set promotion" },
  ],
};
