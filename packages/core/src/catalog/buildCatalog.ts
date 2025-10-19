import type { HistoryEntry, Catalog } from "@eventvisor/types";

import { getRelativePaths } from "./getRelativePaths";
import { getLastModifiedFromHistory } from "./getLastModifiedFromHistory";
import { RepoDetails } from "./getRepoDetails";
import { Dependencies } from "../dependencies";

export async function buildCatalog(
  deps: Dependencies,
  fullHistory: HistoryEntry[],
  repoDetails: RepoDetails | undefined,
): Promise<Catalog> {
  const { rootDirectoryPath, projectConfig, datasource } = deps;

  const result: Catalog = {
    links: undefined,
    projectConfig: {
      tags: projectConfig.tags,
    },
    entities: {
      attributes: {},
      events: {},
      destinations: {},
      effects: {},
    },
  };

  /**
   * Links
   */
  if (repoDetails) {
    const {
      relativeAttributesPath,
      relativeEventsPath,
      relativeDestinationsPath,
      relativeEffectsPath,
    } = getRelativePaths(rootDirectoryPath, projectConfig);

    let prefix = "";
    if (repoDetails.topLevelPath !== rootDirectoryPath) {
      prefix = rootDirectoryPath.replace(repoDetails.topLevelPath + "/", "") + "/";
    }

    result.links = {
      attribute: repoDetails.blobUrl.replace(
        "{{blobPath}}",
        prefix + relativeAttributesPath + "/{{name}}." + datasource.getExtension(),
      ),
      event: repoDetails.blobUrl.replace(
        "{{blobPath}}",
        prefix + relativeEventsPath + "/{{name}}." + datasource.getExtension(),
      ),
      destination: repoDetails.blobUrl.replace(
        "{{blobPath}}",
        prefix + relativeDestinationsPath + "/{{name}}." + datasource.getExtension(),
      ),
      effect: repoDetails.blobUrl.replace(
        "{{blobPath}}",
        prefix + relativeEffectsPath + "/{{name}}." + datasource.getExtension(),
      ),
      commit: repoDetails.commitUrl,
    };
  }

  /**
   * Entities
   */
  // events
  const eventFiles = await datasource.listEvents();

  for (const entityName of eventFiles) {
    const parsed = await datasource.readEvent(entityName);

    result.entities.events[entityName] = {
      ...parsed,
      lastModified: getLastModifiedFromHistory(fullHistory, "event", entityName),
    };
  }

  // destinations
  const destinationFiles = await datasource.listDestinations();
  for (const entityName of destinationFiles) {
    const parsed = await datasource.readDestination(entityName);

    result.entities.destinations[entityName] = {
      ...parsed,
      lastModified: getLastModifiedFromHistory(fullHistory, "destination", entityName),
    };
  }

  // effects
  const effectFiles = await datasource.listEffects();
  for (const entityName of effectFiles) {
    const parsed = await datasource.readEffect(entityName);

    result.entities.effects[entityName] = {
      ...parsed,
      lastModified: getLastModifiedFromHistory(fullHistory, "effect", entityName),
    };
  }

  // attributes
  const attributeFiles = await datasource.listAttributes();
  for (const entityName of attributeFiles) {
    const parsed = await datasource.readAttribute(entityName);

    result.entities.attributes[entityName] = {
      ...parsed,
      lastModified: getLastModifiedFromHistory(fullHistory, "attribute", entityName),
    };
  }

  return result;
}
