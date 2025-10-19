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

    if (!allowedSubcommands.includes(subcommand)) {
      console.log("Please specify a subcommand: `export` or `serve`");
      return;
    }

    // export
    if (subcommand === "export") {
      return await exportCatalog(deps);
    }

    // serve
    if (subcommand === "serve") {
      return await serveCatalog(deps);
    }
  },
  examples: [
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
