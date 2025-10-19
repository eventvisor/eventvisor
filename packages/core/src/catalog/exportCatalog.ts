import * as fs from "fs";
import * as path from "path";

import { generateHistory } from "./generateHistory";
import { getRepoDetails } from "./getRepoDetails";
import { buildCatalog } from "./buildCatalog";
import { Dependencies } from "../dependencies";

export async function exportCatalog(deps: Dependencies) {
  const { projectConfig } = deps;

  fs.mkdirSync(projectConfig.catalogExportDirectoryPath, { recursive: true });

  const catalogPackagePath = path.dirname(require.resolve("@eventvisor/catalog/package.json"));

  // copy catalog dist
  const catalogDistPath = path.join(catalogPackagePath, "dist");
  fs.cpSync(catalogDistPath, projectConfig.catalogExportDirectoryPath, { recursive: true });

  console.log("Catalog dist copied to:", projectConfig.catalogExportDirectoryPath);

  // generate history
  const fullHistory = await generateHistory(deps);

  // site search index
  const repoDetails = getRepoDetails();
  const catalog = await buildCatalog(deps, fullHistory, repoDetails);
  const catalogFilePath = path.join(projectConfig.catalogExportDirectoryPath, "catalog.json");
  fs.writeFileSync(catalogFilePath, JSON.stringify(catalog));
  console.log(`Catalog written at: ${catalogFilePath}`);

  // copy datafiles
  fs.cpSync(
    projectConfig.datafilesDirectoryPath,
    path.join(projectConfig.catalogExportDirectoryPath, "datafiles"),
    { recursive: true },
  );

  return true;
}
