import { Plugin } from "../cli";
import { exportCatalog } from "./exportCatalog";
import { serveCatalog } from "./serveCatalog";
import { Dependencies } from "../dependencies";

export const catalogPlugin: Plugin = {
  command: "catalog",
  handler: async function (options) {
    const { rootDirectoryPath, projectConfig, datasource, parsed } = options;
    const deps: Dependencies = { rootDirectoryPath, projectConfig, datasource, options: parsed };

    const allowedSubcommands = ["export", "serve"];
    const subcommand = parsed._[1];

    if (subcommand && !allowedSubcommands.includes(subcommand)) {
      throw new Error("Unknown catalog subcommand. Use `export` or `serve`.");
    }

    // export
    if (subcommand === "export") {
      return await exportCatalog(deps);
    }

    // serve
    if (subcommand === "serve") {
      return await serveCatalog(deps);
    }

    await exportCatalog(deps);
    return await serveCatalog(deps);
  },
  options: { port: { type: "number", alias: "p", description: "catalog server port" } },
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
