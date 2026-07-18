import type { HistoryEntry, Catalog } from "@eventvisor/types";
import * as path from "path";

import { getRelativePaths } from "./getRelativePaths";
import { getLastModifiedFromHistory } from "./getLastModifiedFromHistory";
import { RepoDetails } from "./getRepoDetails";
import { Dependencies } from "../dependencies";
import { buildDatafile } from "../builder/buildProject";
import { collectSchemaReferences } from "../schemas";
import { buildDependencyGraph, entityId, invertDependencyGraph } from "../utils/dependencyGraph";

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
      schemas: {},
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
      relativeSchemasPath,
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
      schema: repoDetails.blobUrl.replace(
        "{{blobPath}}",
        prefix + relativeSchemasPath + "/{{name}}." + datasource.getExtension(),
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

  for (const entityName of await datasource.listSchemas()) {
    result.entities.schemas[entityName] = {
      ...(await datasource.readSchema(entityName)),
      lastModified: getLastModifiedFromHistory(fullHistory, "schema", entityName),
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
    const schemaQueue = [
      ...Object.keys(datafile.attributes).flatMap((key) =>
        collectSchemaReferences(result.entities.attributes[key] || {}),
      ),
      ...Object.keys(datafile.events).flatMap((key) =>
        collectSchemaReferences(result.entities.events[key] || {}),
      ),
    ];
    const selectedSchemas = new Set<string>();
    while (schemaQueue.length) {
      const schemaKey = schemaQueue.shift() as string;
      if (selectedSchemas.has(schemaKey) || !result.entities.schemas[schemaKey]) continue;
      selectedSchemas.add(schemaKey);
      schemaQueue.push(...collectSchemaReferences(result.entities.schemas[schemaKey]));
    }
    selectedSchemas.forEach((schemaKey) => {
      const schema = result.entities.schemas[schemaKey];
      schema.targets = [...(schema.targets || []), targetName];
    });
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
    "schemas",
    "targets",
    "tests",
  ] as const;
  const inverseGraph = invertDependencyGraph(await buildDependencyGraph(datasource));
  for (const type of collections) {
    for (const key of Object.keys(result.entities[type])) {
      const usageKey = `${type}:${key}`;
      const singular = type.slice(0, -1) as any;
      result.usages[usageKey] = inverseGraph[entityId(singular, key)] || [];
    }
  }

  return result;
}
