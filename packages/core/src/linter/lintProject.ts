import { Plugin } from "../cli";
import { Dependencies } from "../dependencies";

import { getAttributeSchema } from "./attributeSchema";
import { getDestinationSchema } from "./destinationSchema";
import { getEffectSchema } from "./effectSchema";
import { getEventSchema } from "./eventSchema";
import { printError } from "./printError";

async function lintProject(
  options: Dependencies,
  filterOptions: {
    keyPattern?: string;
    entityType?: string;
  } = {},
): Promise<boolean> {
  const { projectConfig, datasource } = options;
  const { keyPattern, entityType } = filterOptions;

  let hasErrors = false;

  // attributes
  console.log("\nLinting attributes...");

  const attributes = await datasource.listAttributes();
  const attributeSchema = getAttributeSchema(options);

  for (const attributeKey of attributes) {
    if (entityType && entityType !== "attribute") {
      continue;
    }

    if (keyPattern && !attributeKey.includes(keyPattern)) {
      continue;
    }

    const attributeContent = await datasource.readAttribute(attributeKey);
    const result = attributeSchema.safeParse(attributeContent);

    if (!result.success) {
      printError({
        entityType: "attribute",
        entityKey: attributeKey,
        error: result.error,
        projectConfig,
      });
      hasErrors = true;
    }
  }

  // events
  console.log("\nLinting events...");

  const events = await datasource.listEvents();
  const eventSchema = getEventSchema(options);

  for (const eventKey of events) {
    if (entityType && entityType !== "event") {
      continue;
    }

    if (keyPattern && !eventKey.includes(keyPattern)) {
      continue;
    }

    const eventContent = await datasource.readEvent(eventKey);
    const result = eventSchema.safeParse(eventContent);

    if (!result.success) {
      printError({
        entityType: "event",
        entityKey: eventKey,
        error: result.error,
        projectConfig,
      });

      hasErrors = true;
    }
  }

  // destinations
  console.log("\nLinting destinations...");

  const destinations = await datasource.listDestinations();
  const destinationSchema = getDestinationSchema(options);

  for (const destinationKey of destinations) {
    if (entityType && entityType !== "destination") {
      continue;
    }

    if (keyPattern && !destinationKey.includes(keyPattern)) {
      continue;
    }

    const destinationContent = await datasource.readDestination(destinationKey);
    const result = destinationSchema.safeParse(destinationContent);

    if (!result.success) {
      printError({
        entityType: "destination",
        entityKey: destinationKey,
        error: result.error,
        projectConfig,
      });
      hasErrors = true;
    }
  }

  // effects
  console.log("\nLinting effects...");

  const effects = await datasource.listEffects();
  const effectSchema = getEffectSchema(options);

  for (const effectKey of effects) {
    if (entityType && entityType !== "effect") {
      continue;
    }

    if (keyPattern && !effectKey.includes(keyPattern)) {
      continue;
    }

    const effectContent = await datasource.readEffect(effectKey);
    const result = effectSchema.safeParse(effectContent);

    if (!result.success) {
      printError({
        entityType: "effect",
        entityKey: effectKey,
        error: result.error,
        projectConfig,
      });
      hasErrors = true;
    }
  }

  // @TODO: tests

  if (hasErrors) {
    return false;
  }

  return true;
}

export const lintPlugin: Plugin = {
  command: "lint",
  handler: async function (options) {
    const { rootDirectoryPath, projectConfig, datasource, parsed } = options;

    const successfullyLinted = await lintProject(
      {
        rootDirectoryPath,
        projectConfig,
        datasource,
        options: parsed,
      },
      {
        keyPattern: parsed.keyPattern,
        entityType: parsed.entityType,
      },
    );

    return successfullyLinted;
  },
  examples: [
    {
      command: "lint",
      description: "lint all entities",
    },
    // {
    //   command: "lint --entityType=event",
    //   description: "lint only events",
    // },
    // {
    //   command: 'lint --keyPattern="abc"',
    //   description: `lint only entities with keys containing "abc"`,
    // },
  ],
};
