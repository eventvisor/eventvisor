import { DatafileContent } from "@eventvisor/types";

import { SCHEMA_VERSION } from "../config/projectConfig";
import { Dependencies } from "../dependencies";
import { Plugin } from "../cli";
import { generateHashForDatafile } from "./hashes";

export interface BuildCLIOptions {
  tag?: string;
  revision?: string;
  revisionFromHash?: boolean;
  schemaVersion?: string;

  // event?: string;
  json?: boolean;
  pretty?: boolean;
  systemFiles?: boolean; // --no-system-files in CLI
  // inflate?: number;
  datafilesDir?: string;
}

export function getNextRevision(currentRevision: string) {
  // If the string is empty or can't be parsed with parseInt(), return "1".
  if (!currentRevision || isNaN(parseInt(currentRevision, 10))) {
    return "1";
  }

  return (parseInt(currentRevision, 10) + 1).toString();
}

export interface BuildDatafileOptions {
  tag?: string;
  revision?: string;
}

export async function buildDatafile(
  deps: Dependencies,
  options: BuildDatafileOptions = {},
): Promise<DatafileContent> {
  const { tag, revision } = options;
  const { datasource } = deps;

  const datafileContent: DatafileContent = {
    schemaVersion: SCHEMA_VERSION,
    revision: revision || "1",
    attributes: {},
    events: {},
    destinations: {},
    effects: {},
  };

  // attributes
  const attributes = await datasource.listAttributes();
  for (const attribute of attributes) {
    const parsedAttribute = await datasource.readAttribute(attribute);

    if (!parsedAttribute) {
      continue;
    }

    if (typeof parsedAttribute.archived === "boolean" && parsedAttribute.archived === true) {
      continue;
    }

    if (tag && !parsedAttribute.tags?.includes(tag)) {
      continue;
    }

    delete parsedAttribute.description;
    delete parsedAttribute.tags;

    // @TODO: stringify conditions and transforms

    datafileContent.attributes[attribute] = parsedAttribute;
  }

  // events
  const events = await datasource.listEvents();
  for (const event of events) {
    const parsedEvent = await datasource.readEvent(event);

    if (!parsedEvent) {
      continue;
    }

    if (typeof parsedEvent.archived === "boolean" && parsedEvent.archived === true) {
      continue;
    }

    if (tag && !parsedEvent.tags?.includes(tag)) {
      continue;
    }

    delete parsedEvent.description;
    delete parsedEvent.tags;

    // @TODO: stringify conditions and transforms

    datafileContent.events[event] = parsedEvent;
  }

  // destinations
  const destinations = await datasource.listDestinations();
  for (const destination of destinations) {
    const parsedDestination = await datasource.readDestination(destination);

    if (!parsedDestination) {
      continue;
    }

    if (typeof parsedDestination.archived === "boolean" && parsedDestination.archived === true) {
      continue;
    }

    if (tag && !parsedDestination.tags?.includes(tag)) {
      continue;
    }

    delete parsedDestination.description;
    delete parsedDestination.tags;

    // @TODO: stringify conditions and transforms

    datafileContent.destinations[destination] = parsedDestination;
  }

  // effects
  const effects = await datasource.listEffects();
  for (const effect of effects) {
    const parsedEffect = await datasource.readEffect(effect);

    if (!parsedEffect) {
      continue;
    }

    if (typeof parsedEffect.archived === "boolean" && parsedEffect.archived === true) {
      continue;
    }

    if (tag && !parsedEffect.tags?.includes(tag)) {
      continue;
    }

    delete parsedEffect.description;
    delete parsedEffect.tags;

    // @TODO: stringify conditions and transforms

    datafileContent.effects[effect] = parsedEffect;
  }

  return datafileContent;
}

export async function buildProject(deps: Dependencies, cliOptions: BuildCLIOptions = {}) {
  const { projectConfig, datasource } = deps;

  /**
   * Regular build process writing to disk
   */
  const { tags } = projectConfig;

  const currentRevision = await datasource.readRevision();
  const nextRevision =
    (cliOptions.revision && cliOptions.revision.toString()) || getNextRevision(currentRevision);

  // print
  if (cliOptions.json) {
    const datafileContent = await buildDatafile(deps, {
      tag: cliOptions.tag,
      revision: cliOptions.revision,
    });

    if (cliOptions.revisionFromHash) {
      datafileContent.revision = generateHashForDatafile(datafileContent);
    }

    if (cliOptions.pretty) {
      console.log(JSON.stringify(datafileContent, null, 2));
    } else {
      console.log(JSON.stringify(datafileContent));
    }

    return;
  }

  console.log("\nCurrent revision:", currentRevision);

  for (const tag of tags) {
    const datafileContent = await buildDatafile(deps, {
      tag,
      revision: nextRevision,
    });

    if (cliOptions.revisionFromHash) {
      datafileContent.revision = generateHashForDatafile(datafileContent);
    }

    console.log(`\n  => Tag: ${tag}`);
    await datasource.writeDatafile(datafileContent, { tag, datafilesDir: cliOptions.datafilesDir });
  }

  await datasource.writeRevision(nextRevision);

  console.log("\nLatest revision:", nextRevision, "\n");
}

export const buildPlugin: Plugin = {
  command: "build",
  handler: async function ({ rootDirectoryPath, projectConfig, datasource, parsed }) {
    await buildProject(
      {
        rootDirectoryPath,
        projectConfig,
        datasource,
        options: parsed,
      },
      parsed as BuildCLIOptions,
    );
  },
  examples: [],
};
