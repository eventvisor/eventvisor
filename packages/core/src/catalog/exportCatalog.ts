import * as fs from "fs";
import * as path from "path";
import type { Catalog, HistoryEntry } from "@eventvisor/types";

import { generateHistory } from "./generateHistory";
import { getRepoDetails } from "./getRepoDetails";
import { buildCatalog } from "./buildCatalog";
import type { Dependencies } from "../dependencies";
import { getProjectSetExecutions } from "../sets";

const CATALOG_SCHEMA_VERSION = "1";
const HISTORY_PAGE_SIZE = 50;

type CatalogEntityType = "event" | "attribute" | "destination" | "effect" | "target";
type CatalogCollection = "events" | "attributes" | "destinations" | "effects" | "targets";
type CatalogHistoryEntry = Omit<HistoryEntry, "entities"> & {
  set?: string;
  entities: Array<HistoryEntry["entities"][number] & { set?: string }>;
};

const collections: Record<CatalogEntityType, CatalogCollection> = {
  event: "events",
  attribute: "attributes",
  destination: "destinations",
  effect: "effects",
  target: "targets",
};

function writeJson(filePath: string, value: unknown) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
}

function encodeKeyPath(key: string) {
  return key
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join(path.sep);
}

function sortSetKeys(keys: string[]) {
  const group = (key: string) => {
    const value = key.toLowerCase();
    if (value.startsWith("dev")) return 0;
    if (value.startsWith("prod")) return 2;
    return 1;
  };

  return keys
    .slice()
    .sort((left, right) => group(left) - group(right) || left.localeCompare(right));
}

function getTests(catalog: Catalog, type: CatalogEntityType, key: string) {
  return Object.entries(catalog.entities.tests)
    .filter(([, test]) => (test as unknown as Record<string, unknown>)[type] === key)
    .map(([testKey, test]) => ({ ...test, key: testKey }));
}

function getSourceUrl(catalog: Catalog, type: CatalogEntityType, key: string) {
  const template = catalog.links?.[type];
  return template?.replace("{{name}}", key);
}

function getEntityHistory(history: HistoryEntry[], type: CatalogEntityType, key: string) {
  return history.filter((entry) =>
    entry.entities.some((entity) => entity.type === type && entity.key === key),
  );
}

function writeHistoryPages(directoryPath: string, entries: unknown[]) {
  const totalPages = Math.max(1, Math.ceil(entries.length / HISTORY_PAGE_SIZE));
  for (let page = 1; page <= totalPages; page++) {
    writeJson(path.join(directoryPath, `page-${page}.json`), {
      page,
      pageSize: HISTORY_PAGE_SIZE,
      totalPages,
      entries: entries.slice((page - 1) * HISTORY_PAGE_SIZE, page * HISTORY_PAGE_SIZE),
    });
  }
}

function getSummary(type: CatalogEntityType, key: string, entity: Record<string, any>) {
  const summary: Record<string, unknown> = {
    key,
    description: entity.description,
    archived: entity.archived,
    deprecated: entity.deprecated,
    tags: entity.tags || [],
    targets: entity.targets || [],
    lastModified: entity.lastModified,
  };

  if (type === "event" || type === "attribute") summary.schemaType = entity.type;
  if (type === "event") {
    summary.level = entity.level;
    summary.requiredAttributeCount = entity.requiredAttributes?.length || 0;
  }
  if (type === "destination") summary.transport = entity.transport;
  if (type === "effect") {
    const on = entity.on;
    summary.triggerCount = Array.isArray(on)
      ? on.length
      : Object.values(on || {}).reduce<number>(
          (total, values) => total + (Array.isArray(values) ? values.length : 0),
          0,
        );
  }
  if (type === "target") {
    summary.selectionCount = Object.keys(entity).filter(
      (field) => field.startsWith("include") || field.startsWith("exclude"),
    ).length;
  }

  return summary;
}

function buildRelationships(catalog: Catalog, type: CatalogEntityType, key: string) {
  const relationships: Record<string, string[]> = {};
  const entity = catalog.entities[collections[type]][key] as Record<string, any> | undefined;
  if (entity?.targets?.length) relationships.targets = [...entity.targets].sort();

  const usages = catalog.usages[`${collections[type]}:${key}`] || [];
  for (const usage of usages) {
    const name = `${usage.type}s`;
    relationships[name] ||= [];
    relationships[name].push(usage.key);
  }

  if (type === "target") {
    for (const [candidateType, collection] of Object.entries(collections) as [
      CatalogEntityType,
      CatalogCollection,
    ][]) {
      if (candidateType === "target") continue;
      const selected = Object.entries(catalog.entities[collection])
        .filter(([, candidate]) => (candidate as any).targets?.includes(key))
        .map(([candidateKey]) => candidateKey)
        .sort();
      if (selected.length) relationships[collection] = selected;
    }
  }

  for (const values of Object.values(relationships)) values.sort();
  return relationships;
}

function exportExecution(
  outputRoot: string,
  dataRoot: string,
  catalog: Catalog,
  history: HistoryEntry[],
  set: string,
) {
  const entities = {} as Record<CatalogEntityType, Record<string, any>[]>;
  const counts = {} as Record<CatalogEntityType, number>;

  for (const [type, collection] of Object.entries(collections) as [
    CatalogEntityType,
    CatalogCollection,
  ][]) {
    const records = catalog.entities[collection] as Record<string, Record<string, any>>;
    entities[type] = Object.entries(records)
      .map(([key, entity]) => getSummary(type, key, entity))
      .sort((left, right) => String(left.key).localeCompare(String(right.key)));
    counts[type] = entities[type].length;

    for (const [key, entity] of Object.entries(records)) {
      const entityDirectory = path.join(dataRoot, "entities", type, encodeKeyPath(key));
      const historyPath = path.join(entityDirectory, "history");
      const entityHistory = getEntityHistory(history, type, key);
      const tests = type === "target" ? [] : getTests(catalog, type, key);
      writeJson(`${entityDirectory}.json`, {
        type,
        key,
        entity,
        sourceUrl: getSourceUrl(catalog, type, key),
        lastModified: entity.lastModified,
        relationships: buildRelationships(catalog, type, key),
        tests,
        historyPath: path.relative(outputRoot, historyPath).split(path.sep).join("/"),
      });
      writeHistoryPages(historyPath, entityHistory);
    }
  }

  writeJson(path.join(dataRoot, "index.json"), { set, counts, entities });
  writeHistoryPages(path.join(dataRoot, "history"), history);
  return counts;
}

export async function exportCatalog(deps: Dependencies) {
  const { projectConfig } = deps;
  const outputRoot = projectConfig.catalogExportDirectoryPath;
  for (const artifact of [
    "assets",
    "data",
    "img",
    "sets",
    "index.html",
    "catalog.json",
    "catalog-manifest.json",
    "history-full.json",
  ]) {
    fs.rmSync(path.join(outputRoot, artifact), { recursive: true, force: true });
  }
  fs.mkdirSync(outputRoot, { recursive: true });

  const catalogPackagePath = path.dirname(require.resolve("@eventvisor/catalog/package.json"));
  fs.cpSync(path.join(catalogPackagePath, "dist"), outputRoot, { recursive: true });

  const repoDetails = getRepoDetails();
  const executions = await getProjectSetExecutions(projectConfig, deps.datasource);
  const setKeys = sortSetKeys(executions.map((execution) => execution.set).filter(Boolean));
  const counts: Record<string, Record<CatalogEntityType, number>> = {};
  const projectHistory: CatalogHistoryEntry[] = [];
  let links: Catalog["links"];

  for (const execution of executions) {
    const executionDeps = {
      ...deps,
      projectConfig: execution.projectConfig,
      datasource: execution.datasource,
    };
    fs.mkdirSync(execution.projectConfig.catalogExportDirectoryPath, { recursive: true });
    const history = await generateHistory(executionDeps);
    const catalog = await buildCatalog(executionDeps, history, repoDetails);
    links ||= catalog.links;
    const dataRoot = execution.set
      ? path.join(outputRoot, "data", "sets", encodeURIComponent(execution.set))
      : path.join(outputRoot, "data", "root");
    counts[execution.set || "root"] = exportExecution(
      outputRoot,
      dataRoot,
      catalog,
      history,
      execution.set,
    );
    projectHistory.push(
      ...history.map((entry) => ({
        ...entry,
        set: execution.set || undefined,
        entities: entry.entities.map((entity) => ({
          ...entity,
          set: execution.set || undefined,
        })),
      })),
    );
  }

  projectHistory.sort((left, right) => right.timestamp.localeCompare(left.timestamp));
  writeHistoryPages(path.join(outputRoot, "data", "project", "history"), projectHistory);
  writeJson(path.join(outputRoot, "data", "manifest.json"), {
    schemaVersion: CATALOG_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    router: "hash",
    sets: projectConfig.sets,
    setKeys,
    projectConfig: { tags: projectConfig.tags },
    links: {
      commit: links?.commit,
    },
    paths: {
      projectHistory: "data/project/history",
      root: projectConfig.sets ? undefined : "data/root",
      sets: Object.fromEntries(setKeys.map((set) => [set, `data/sets/${encodeURIComponent(set)}`])),
    },
    counts,
  });

  console.log(`Catalog exported to: ${outputRoot}`);
  return true;
}
