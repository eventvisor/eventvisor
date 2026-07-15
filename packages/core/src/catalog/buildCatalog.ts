import type { HistoryEntry, Catalog } from "@eventvisor/types";
import * as path from "path";

import { getRelativePaths } from "./getRelativePaths";
import { getLastModifiedFromHistory } from "./getLastModifiedFromHistory";
import { RepoDetails } from "./getRepoDetails";
import { Dependencies } from "../dependencies";
import { buildDatafile } from "../builder/buildProject";

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
      sets: projectConfig.sets,
    },
    entities: {
      attributes: {},
      events: {},
      destinations: {},
      effects: {},
      targets: {},
      tests: {},
    },
    usages: {},
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
      target: repoDetails.blobUrl.replace(
        "{{blobPath}}",
        prefix +
          path.relative(rootDirectoryPath, projectConfig.targetsDirectoryPath) +
          "/{{name}}." +
          datasource.getExtension(),
      ),
      test: repoDetails.blobUrl.replace(
        "{{blobPath}}",
        prefix +
          path.relative(rootDirectoryPath, projectConfig.testsDirectoryPath) +
          "/{{name}}." +
          datasource.getExtension(),
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

  for (const entityName of await datasource.listTargets()) {
    result.entities.targets[entityName] = {
      ...(await datasource.readTarget(entityName)),
      lastModified: getLastModifiedFromHistory(fullHistory, "target", entityName),
    };
  }

  for (const targetName of Object.keys(result.entities.targets)) {
    const datafile = await buildDatafile(deps, { target: targetName });
    for (const type of ["attributes", "events", "destinations", "effects"] as const) {
      for (const key of Object.keys(datafile[type])) {
        const entity = result.entities[type][key];
        if (entity) entity.targets = [...(entity.targets || []), targetName];
      }
    }
  }

  for (const entityName of await datasource.listTests()) {
    result.entities.tests[entityName] = {
      ...(await datasource.readTest(entityName)),
      key: entityName,
    };
  }

  const collections = [
    "attributes",
    "events",
    "destinations",
    "effects",
    "targets",
    "tests",
  ] as const;
  for (const type of collections) {
    for (const key of Object.keys(result.entities[type])) {
      const needle = JSON.stringify(key);
      const usageKey = `${type}:${key}`;
      result.usages[usageKey] = [];
      for (const candidateType of collections) {
        for (const [candidateKey, candidate] of Object.entries(result.entities[candidateType])) {
          if (type === candidateType && key === candidateKey) continue;
          if (JSON.stringify(candidate).includes(needle)) {
            result.usages[usageKey].push({
              type: candidateType.slice(0, -1) as any,
              key: candidateKey,
            });
          }
        }
      }
    }
  }

  return result;
}
