import * as path from "path";

import { Plugin } from "../cli";
import { exportCatalog } from "./exportCatalog";
import { serveCatalog } from "./serveCatalog";
import { Dependencies } from "../dependencies";
import { CONFIG_MODULE_NAME, getProjectConfig, ProjectConfig } from "../config";
import { Datasource } from "../datasource";
import { createCatalogInputWatcher } from "./watchCatalog";

function reloadCatalogDependencies(deps: Dependencies): Dependencies {
  const configPath = path.join(deps.rootDirectoryPath, CONFIG_MODULE_NAME);
  const resolvedConfigPath = require.resolve(configPath);
  delete require.cache[resolvedConfigPath];
  const projectConfig = getProjectConfig(deps.rootDirectoryPath);

  return {
    ...deps,
    projectConfig,
    datasource: new Datasource(projectConfig, deps.rootDirectoryPath),
  };
}

function getIgnoredCatalogWatchPaths(deps: Dependencies) {
  const outputDirectoryPath = deps.options.outDir
    ? path.resolve(deps.rootDirectoryPath, deps.options.outDir)
    : deps.projectConfig.catalogExportDirectoryPath;

  return [
    path.join(deps.rootDirectoryPath, ".git"),
    path.join(deps.rootDirectoryPath, "node_modules"),
    deps.projectConfig.systemDirectoryPath,
    deps.projectConfig.datafilesDirectoryPath,
    deps.projectConfig.catalogExportDirectoryPath,
    outputDirectoryPath,
  ];
}

export const catalogPlugin: Plugin = {
  command: "catalog [subcommand]",
  description: "export or serve the project Catalog",
  handler: async function (options) {
    const { rootDirectoryPath, projectConfig, datasource, parsed } = options;
    const deps: Dependencies = { rootDirectoryPath, projectConfig, datasource, options: parsed };

    const allowedSubcommands = ["export", "serve"];
    const subcommand = parsed.subcommand as string | undefined;

    if (subcommand && !allowedSubcommands.includes(subcommand)) {
      throw new Error("Unknown catalog subcommand. Use `export` or `serve`.");
    }

    // export
    if (subcommand === "export") {
      return await exportCatalog(deps);
    }

    // serve
    if (subcommand === "serve") {
      await serveCatalog(deps);
      return true;
    }

    await exportCatalog(deps);
    const server = await serveCatalog(deps, { liveReload: true });
    let currentDeps = deps;
    let exportInFlight = false;
    let exportQueued = false;
    let debounceTimer: ReturnType<typeof setTimeout> | undefined;
    let stopWatching = () => undefined;

    const startWatching = (projectConfig: ProjectConfig) => {
      stopWatching();
      stopWatching = createCatalogInputWatcher(
        currentDeps.rootDirectoryPath,
        projectConfig,
        getIgnoredCatalogWatchPaths(currentDeps),
        (changedPaths) => {
          if (debounceTimer) clearTimeout(debounceTimer);
          debounceTimer = setTimeout(() => {
            debounceTimer = undefined;
            void rebuildAndReload(changedPaths);
          }, 150);
        },
      );
    };

    const rebuildAndReload = async (changedPaths: string[]) => {
      if (exportInFlight) {
        exportQueued = true;
        return;
      }

      exportInFlight = true;
      const changed = changedPaths
        .slice(0, 3)
        .map((filePath) => path.relative(currentDeps.rootDirectoryPath, filePath))
        .join(", ");
      console.log(`\n[catalog] Rebuilding because ${changed || "project files changed"}`);

      try {
        const refreshedDeps = reloadCatalogDependencies(currentDeps);
        refreshedDeps.options = { ...refreshedDeps.options, assets: false };
        await exportCatalog(refreshedDeps);
        currentDeps = refreshedDeps;
        startWatching(currentDeps.projectConfig);
        server.triggerReload();
      } catch (error) {
        console.error("[catalog] Export failed during watch mode");
        console.error(error);
      } finally {
        exportInFlight = false;
        if (exportQueued) {
          exportQueued = false;
          void rebuildAndReload([]);
        }
      }
    };

    startWatching(currentDeps.projectConfig);
    process.on("exit", () => stopWatching());
    return true;
  },
  options: {
    subcommand: { type: "string", description: "export or serve", choices: ["export", "serve"] },
    port: { type: "number", alias: "p", description: "catalog server port" },
    "out-dir": { type: "string", description: "catalog output directory" },
    assets: { type: "boolean", description: "copy the Catalog UI assets" },
    "hash-router": { type: "boolean", description: "use hash-based Catalog URLs" },
    "base-path": { type: "string", description: "URL path where the Catalog is hosted" },
  },
  examples: [
    {
      command: "catalog",
      description: "export and serve the catalog",
    },
    {
      command: "catalog export",
      description: "export catalog of all entities",
    },
    {
      command: "catalog serve",
      description: "serve catalog of all entities",
    },
  ],
};
