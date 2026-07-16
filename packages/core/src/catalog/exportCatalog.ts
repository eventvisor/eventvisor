import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import type { Catalog, HistoryEntry } from "@eventvisor/types";

import { generateHistory } from "./generateHistory";
import { getRepoDetails } from "./getRepoDetails";
import type { RepoDetails } from "./getRepoDetails";
import { buildCatalog } from "./buildCatalog";
import type { Dependencies } from "../dependencies";
import { getProjectSetExecutions } from "../sets";
import {
  CLI_COLOR_CYAN,
  CLI_FORMAT_BOLD,
  CLI_FORMAT_DIM,
  CLI_FORMAT_GREEN,
  colorize,
} from "../tester/cliFormat";
import { prettyDuration } from "../utils";
import { expandAssertions } from "../tester/matrix";

const CATALOG_SCHEMA_VERSION = "1";
const HISTORY_PAGE_SIZE = 50;
const CATALOG_MARKER = ".eventvisor-catalog";

type CatalogEntityType = "event" | "attribute" | "destination" | "effect" | "schema" | "target";
type CatalogCollection =
  "events" | "attributes" | "destinations" | "effects" | "schemas" | "targets";
type CatalogHistoryEntry = Omit<HistoryEntry, "entities"> & {
  set?: string;
  entities: Array<HistoryEntry["entities"][number] & { set?: string }>;
};

const collections: Record<CatalogEntityType, CatalogCollection> = {
  event: "events",
  attribute: "attributes",
  destination: "destinations",
  effect: "effects",
  schema: "schemas",
  target: "targets",
};

function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function formatCatalogPath(rootDirectoryPath: string, filePath: string) {
  const relativePath = path.relative(rootDirectoryPath, filePath);
  return relativePath && !relativePath.startsWith("..") && !path.isAbsolute(relativePath)
    ? relativePath
    : filePath;
}

class CatalogProgressReporter {
  private readonly startedAt = Date.now();

  constructor(
    private readonly rootDirectoryPath: string,
    private readonly outputDirectoryPath: string,
  ) {}

  start(sets: boolean, browserRouter: boolean) {
    console.log("");
    console.log(CLI_FORMAT_BOLD, "Generating Eventvisor catalog");
    console.log(
      `  ${colorize("Output", CLI_COLOR_CYAN)}: ${formatCatalogPath(
        this.rootDirectoryPath,
        this.outputDirectoryPath,
      )}`,
    );
    console.log(`  ${colorize("Router", CLI_COLOR_CYAN)}: ${browserRouter ? "browser" : "hash"}`);
    console.log(`  ${colorize("Sets", CLI_COLOR_CYAN)}:   ${sets ? "enabled" : "none"}`);
    console.log("");
  }

  step(label: string, detail?: string) {
    console.log(
      `  ${colorize("•", CLI_COLOR_CYAN)} ${label}${detail ? `: ${colorize(detail, 2)}` : ""}`,
    );
    return Date.now();
  }

  done(startedAt: number, detail?: string) {
    console.log(
      CLI_FORMAT_DIM,
      `    done in ${prettyDuration(Date.now() - startedAt)}${detail ? ` ${detail}` : ""}`,
    );
  }

  execution(set?: string) {
    console.log("");
    console.log(CLI_FORMAT_BOLD, set ? `Set "${set}"` : "Root catalog");
  }

  complete() {
    console.log("");
    console.log(
      CLI_FORMAT_GREEN,
      `Catalog exported to ${formatCatalogPath(this.rootDirectoryPath, this.outputDirectoryPath)}`,
    );
    console.log(CLI_FORMAT_BOLD, `Time: ${prettyDuration(Date.now() - this.startedAt)}`);
    console.log("");
  }
}

function writeJson(filePath: string, value: unknown) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
}

export function normalizeCatalogBasePath(value: unknown) {
  if (typeof value !== "string" || !value.trim() || value.trim() === "/") return "";
  const normalized = `/${value.trim().replace(/^\/+|\/+$/g, "")}`;
  if (normalized.includes("..")) throw new Error("Catalog base path cannot contain '..'.");
  return normalized;
}

function applyBasePathToCatalogHtml(outputRoot: string, basePath: string) {
  if (!basePath) return;
  const indexPath = path.join(outputRoot, "index.html");
  const html = fs.readFileSync(indexPath, "utf8");
  fs.writeFileSync(indexPath, html.replace(/(href|src)="\//g, `$1="${basePath}/`));
}

export function assertSafeCatalogOutputPath(
  rootDirectoryPath: string,
  outputDirectoryPath: string,
) {
  const root = path.resolve(rootDirectoryPath);
  const output = path.resolve(outputDirectoryPath);
  const filesystemRoot = path.parse(output).root;
  const home = path.resolve(os.homedir());
  const containsProject = root.startsWith(`${output}${path.sep}`);

  if (output === filesystemRoot || output === home || output === root || containsProject) {
    throw new Error(
      `Refusing to export the Catalog to unsafe directory "${outputDirectoryPath}". Choose a dedicated output directory.`,
    );
  }
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
    .map(([testKey, test]) => ({
      ...test,
      key: testKey,
      assertions: expandAssertions(test.assertions).map((expanded) => ({
        ...expanded.assertion,
        __catalog: {
          assertionIndex: expanded.assertionIndex,
          matrixIndex: expanded.matrixIndex,
          matrixCount: expanded.matrixCount,
          matrixValues: expanded.matrixValues,
        },
      })),
    }));
}

function mapTestHistoryToEntities(history: HistoryEntry[], catalog: Catalog): HistoryEntry[] {
  return history
    .map((entry) => {
      const entities = entry.entities.flatMap((entity) => {
        if (entity.type !== "test") return [entity];
        const test = catalog.entities.tests[entity.key] as unknown as
          Record<string, unknown> | undefined;
        if (!test) return [];
        for (const type of ["event", "attribute", "destination", "effect"] as const) {
          if (typeof test[type] === "string") return [{ type, key: test[type] as string }];
        }
        return [];
      });
      return {
        ...entry,
        entities: entities.filter(
          (entity, index) =>
            entities.findIndex(
              (candidate) => candidate.type === entity.type && candidate.key === entity.key,
            ) === index,
        ),
      };
    })
    .filter((entry) => entry.entities.length > 0);
}

function getSourceUrl(catalog: Catalog, type: CatalogEntityType, key: string) {
  const template = catalog.links?.[type];
  return template?.replace("{{name}}", key);
}

function getSourcePath(
  catalog: Catalog,
  repoDetails: RepoDetails | undefined,
  type: CatalogEntityType,
  key: string,
) {
  const sourceUrl = getSourceUrl(catalog, type, key);
  const sourcePrefix = repoDetails?.blobUrl.split("{{blobPath}}")[0];
  if (!sourceUrl || !sourcePrefix || !sourceUrl.startsWith(sourcePrefix)) return undefined;
  return sourceUrl.slice(sourcePrefix.length);
}

function getEntityHref(type: CatalogEntityType, key: string, set?: string) {
  const encodeRouteSegment = (value: string) => encodeURIComponent(value).replace(/%2F/gi, "%252F");
  const prefix = set ? `/sets/${encodeRouteSegment(set)}` : "";
  return `${prefix}/${collections[type]}/${encodeRouteSegment(key)}`;
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

function getSummary(
  type: CatalogEntityType,
  key: string,
  entity: Record<string, any>,
  set?: string,
) {
  const summary: Record<string, unknown> = {
    key,
    href: getEntityHref(type, key, set),
    description: entity.description,
    archived: entity.archived,
    deprecated: entity.deprecated,
    tags: entity.tags || [],
    targets: entity.targets || [],
    lastModified: entity.lastModified,
  };

  if (type === "event" || type === "attribute" || type === "schema") {
    summary.schemaType = entity.type || (entity.schema ? `schema:${entity.schema}` : undefined);
  }
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

  for (const [name, values] of Object.entries(relationships)) {
    relationships[name] = [...new Set(values)].sort();
  }
  return relationships;
}

function exportExecution(
  outputRoot: string,
  dataRoot: string,
  catalog: Catalog,
  history: HistoryEntry[],
  set: string,
  repoDetails?: RepoDetails,
) {
  const entities = {} as Record<CatalogEntityType, Record<string, any>[]>;
  const counts = {} as Record<CatalogEntityType, number>;

  for (const [type, collection] of Object.entries(collections) as [
    CatalogEntityType,
    CatalogCollection,
  ][]) {
    const records = catalog.entities[collection] as Record<string, Record<string, any>>;
    entities[type] = Object.entries(records)
      .map(([key, entity]) => getSummary(type, key, entity, set))
      .sort((left, right) => String(left.key).localeCompare(String(right.key)));
    counts[type] = entities[type].length;

    for (const [key, entity] of Object.entries(records)) {
      const entityDirectory = path.join(dataRoot, "entities", type, encodeKeyPath(key));
      const historyPath = path.join(entityDirectory, "history");
      const entityHistory = getEntityHistory(history, type, key);
      const tests = type === "target" || type === "schema" ? [] : getTests(catalog, type, key);
      writeJson(`${entityDirectory}.json`, {
        type,
        key,
        entity,
        sourcePath: getSourcePath(catalog, repoDetails, type, key),
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
  const { projectConfig: configuredProjectConfig, rootDirectoryPath } = deps;
  const outputRoot = deps.options.outDir
    ? path.resolve(rootDirectoryPath, deps.options.outDir)
    : configuredProjectConfig.catalogExportDirectoryPath;
  const projectConfig =
    outputRoot === configuredProjectConfig.catalogExportDirectoryPath
      ? configuredProjectConfig
      : { ...configuredProjectConfig, catalogExportDirectoryPath: outputRoot };
  const copyAssets = deps.options.assets !== false;
  const browserRouter = !(deps.options.hashRouter || deps.options["hash-router"]);
  const basePath = normalizeCatalogBasePath(deps.options.basePath || deps.options["base-path"]);
  const progress = new CatalogProgressReporter(rootDirectoryPath, outputRoot);
  assertSafeCatalogOutputPath(rootDirectoryPath, outputRoot);
  progress.start(projectConfig.sets, browserRouter);
  const prepareStartedAt = progress.step("Preparing catalog output");
  const generatedArtifacts = copyAssets
    ? [
        "assets",
        "data",
        "img",
        "sets",
        "index.html",
        "catalog.json",
        "catalog-manifest.json",
        "history-full.json",
      ]
    : ["data", "catalog.json", "catalog-manifest.json", "history-full.json"];
  for (const artifact of generatedArtifacts) {
    fs.rmSync(path.join(outputRoot, artifact), { recursive: true, force: true });
  }
  fs.mkdirSync(outputRoot, { recursive: true });
  fs.writeFileSync(path.join(outputRoot, CATALOG_MARKER), "Generated by Eventvisor.\n");

  progress.done(prepareStartedAt);

  if (copyAssets) {
    const assetsStartedAt = progress.step("Copying Catalog UI assets");
    const catalogPackagePath = path.dirname(require.resolve("@eventvisor/catalog/package.json"));
    fs.cpSync(path.join(catalogPackagePath, "dist"), outputRoot, { recursive: true });
    applyBasePathToCatalogHtml(outputRoot, basePath);
    progress.done(assetsStartedAt);
  }

  const repoDetails = getRepoDetails(rootDirectoryPath);
  const executions = await getProjectSetExecutions(projectConfig, deps.datasource);
  const setKeys = sortSetKeys(executions.map((execution) => execution.set).filter(Boolean));
  const counts: Record<string, Record<CatalogEntityType, number>> = {};
  const projectHistory: CatalogHistoryEntry[] = [];
  let links: Catalog["links"];

  for (const execution of executions) {
    progress.execution(execution.set || undefined);
    const historyStartedAt = progress.step("Reading project history");
    const executionDeps = {
      ...deps,
      projectConfig: execution.projectConfig,
      datasource: execution.datasource,
    };
    fs.mkdirSync(execution.projectConfig.catalogExportDirectoryPath, { recursive: true });
    const history = await generateHistory(executionDeps);
    progress.done(historyStartedAt, pluralize(history.length, "change"));
    const catalogStartedAt = progress.step("Building catalog data");
    const catalog = await buildCatalog(executionDeps, history, repoDetails);
    const catalogHistory = mapTestHistoryToEntities(history, catalog);
    links ||= catalog.links;
    const dataRoot = execution.set
      ? path.join(outputRoot, "data", "sets", encodeURIComponent(execution.set))
      : path.join(outputRoot, "data", "root");
    counts[execution.set || "root"] = exportExecution(
      outputRoot,
      dataRoot,
      catalog,
      catalogHistory,
      execution.set,
      repoDetails,
    );
    const entityCount = Object.values(counts[execution.set || "root"]).reduce(
      (total, count) => total + count,
      0,
    );
    progress.done(catalogStartedAt, pluralize(entityCount, "definition"));
    projectHistory.push(
      ...catalogHistory.map((entry) => ({
        ...entry,
        set: execution.set || undefined,
        entities: entry.entities.map((entity) => ({
          ...entity,
          set: execution.set || undefined,
        })),
      })),
    );
  }

  const writeStartedAt = progress.step("Writing project index");
  projectHistory.sort((left, right) => right.timestamp.localeCompare(left.timestamp));
  writeHistoryPages(path.join(outputRoot, "data", "project", "history"), projectHistory);
  writeJson(path.join(outputRoot, "data", "manifest.json"), {
    schemaVersion: CATALOG_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    router: browserRouter ? "browser" : "hash",
    basePath,
    sets: projectConfig.sets,
    setKeys,
    projectConfig: { tags: projectConfig.tags },
    links: {
      provider: repoDetails?.provider,
      repository: repoDetails?.repository,
      source: repoDetails?.blobUrl,
      commit: links?.commit,
    },
    paths: {
      projectHistory: "data/project/history",
      root: projectConfig.sets ? undefined : "data/root",
      sets: Object.fromEntries(setKeys.map((set) => [set, `data/sets/${encodeURIComponent(set)}`])),
    },
    counts,
  });
  progress.done(writeStartedAt);

  progress.complete();
  return true;
}
