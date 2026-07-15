import * as z from "zod";

import { Plugin } from "../cli";
import { Dependencies } from "../dependencies";

import { getAttributeSchema } from "./attributeSchema";
import { getDestinationSchema } from "./destinationSchema";
import { getEffectSchema } from "./effectSchema";
import { getEventSchema } from "./eventSchema";
import { getTestSchema } from "./testSchema";
import { getTargetSchema } from "./targetSchema";
import { getProjectSetExecutions } from "../sets";
import { printError } from "./printError";
import { getSemanticIssues, type LintContext } from "./semanticValidation";

async function createLintContext(options: Dependencies): Promise<LintContext> {
  const { datasource } = options;

  const [attributeNames, eventNames, destinationNames, effectNames] = await Promise.all([
    datasource.listAttributes(),
    datasource.listEvents(),
    datasource.listDestinations(),
    datasource.listEffects(),
  ]);

  const [attributes, events, destinations, effects] = await Promise.all([
    Promise.all(
      attributeNames.map(async (name) => [name, await datasource.readAttribute(name)] as const),
    ),
    Promise.all(eventNames.map(async (name) => [name, await datasource.readEvent(name)] as const)),
    Promise.all(
      destinationNames.map(async (name) => [name, await datasource.readDestination(name)] as const),
    ),
    Promise.all(
      effectNames.map(async (name) => [name, await datasource.readEffect(name)] as const),
    ),
  ]);

  return {
    attributes: Object.fromEntries(attributes),
    events: Object.fromEntries(events),
    destinations: Object.fromEntries(destinations),
    effects: Object.fromEntries(effects),
  };
}

export async function lintProject(
  options: Dependencies,
  filterOptions: {
    keyPattern?: string;
    entityType?: string;
  } = {},
): Promise<boolean> {
  const { projectConfig, datasource } = options;
  const { keyPattern, entityType } = filterOptions;
  const lintContext = await createLintContext(options);

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
    const result = await attributeSchema.safeParseAsync(attributeContent);

    if (!result.success) {
      printError({
        entityType: "attribute",
        entityKey: attributeKey,
        error: result.error,
        projectConfig,
      });
      hasErrors = true;
      continue;
    }

    const semanticIssues = getSemanticIssues("attribute", result.data as any, lintContext);

    if (semanticIssues.length > 0) {
      printError({
        entityType: "attribute",
        entityKey: attributeKey,
        error: new z.ZodError(semanticIssues),
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
    const result = await eventSchema.safeParseAsync(eventContent);

    if (!result.success) {
      printError({
        entityType: "event",
        entityKey: eventKey,
        error: result.error,
        projectConfig,
      });

      hasErrors = true;
      continue;
    }

    const semanticIssues = getSemanticIssues("event", result.data as any, lintContext);

    if (semanticIssues.length > 0) {
      printError({
        entityType: "event",
        entityKey: eventKey,
        error: new z.ZodError(semanticIssues),
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
    const result = await destinationSchema.safeParseAsync(destinationContent);

    if (!result.success) {
      printError({
        entityType: "destination",
        entityKey: destinationKey,
        error: result.error,
        projectConfig,
      });
      hasErrors = true;
      continue;
    }

    const semanticIssues = getSemanticIssues("destination", result.data as any, lintContext);

    if (semanticIssues.length > 0) {
      printError({
        entityType: "destination",
        entityKey: destinationKey,
        error: new z.ZodError(semanticIssues),
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
    const result = await effectSchema.safeParseAsync(effectContent);

    if (!result.success) {
      printError({
        entityType: "effect",
        entityKey: effectKey,
        error: result.error,
        projectConfig,
      });
      hasErrors = true;
      continue;
    }

    const semanticIssues = getSemanticIssues("effect", result.data as any, lintContext);

    if (semanticIssues.length > 0) {
      printError({
        entityType: "effect",
        entityKey: effectKey,
        error: new z.ZodError(semanticIssues),
        projectConfig,
      });
      hasErrors = true;
    }
  }

  // tests
  console.log("\nLinting tests...");

  const tests = await datasource.listTests();
  const testSchema = getTestSchema(options);

  for (const testKey of tests) {
    if (entityType && entityType !== "test") {
      continue;
    }

    if (keyPattern && !testKey.includes(keyPattern)) {
      continue;
    }

    const testContent = await datasource.readTest(testKey);
    const result = await testSchema.safeParseAsync(testContent);

    if (!result.success) {
      printError({
        entityType: "test",
        entityKey: testKey,
        error: result.error,
        projectConfig,
      });
      hasErrors = true;
      continue;
    }

    const semanticIssues = getSemanticIssues("test", result.data as any, lintContext);

    if (semanticIssues.length > 0) {
      printError({
        entityType: "test",
        entityKey: testKey,
        error: new z.ZodError(semanticIssues),
        projectConfig,
      });
      hasErrors = true;
    }
  }

  console.log("\nLinting targets...");
  const targets = await datasource.listTargets();
  const targetSchema = getTargetSchema(projectConfig);
  for (const targetKey of targets) {
    if (entityType && entityType !== "target") continue;
    if (keyPattern && !targetKey.includes(keyPattern)) continue;

    const result = await targetSchema.safeParseAsync(await datasource.readTarget(targetKey));
    if (!result.success) {
      printError({
        entityType: "target",
        entityKey: targetKey,
        error: result.error,
        projectConfig,
      });
      hasErrors = true;
    }
  }

  if (hasErrors) {
    return false;
  }

  return true;
}

export const lintPlugin: Plugin = {
  command: "lint",
  options: {
    set: { type: "string" },
    keyPattern: { type: "string" },
    entityType: { type: "string" },
  },
  handler: async function (options) {
    const { rootDirectoryPath, projectConfig, datasource, parsed } = options;

    const executions = await getProjectSetExecutions(projectConfig, datasource, parsed.set);
    let successful = true;
    for (const execution of executions) {
      const result = await lintProject(
        {
          rootDirectoryPath,
          projectConfig: execution.projectConfig,
          datasource: execution.datasource,
          options: parsed,
        },
        { keyPattern: parsed.keyPattern, entityType: parsed.entityType },
      );
      if (!result) successful = false;
    }
    return successful;
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
