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
import { CLI_COLOR_CYAN, CLI_FORMAT_BOLD, CLI_FORMAT_GREEN, colorize } from "../tester/cliFormat";
import { JSONZodSchema } from "./jsonSchema";
import { loadSchemas, resolveEntitySchema, resolveSchema } from "../schemas";

function schemaReferenceError(error: unknown) {
  return new z.ZodError([
    {
      code: "custom",
      path: ["schema"],
      message: (error as Error).message,
    },
  ]);
}

async function createLintContext(
  options: Dependencies,
  schemas: Awaited<ReturnType<typeof loadSchemas>>,
): Promise<LintContext> {
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
    attributes: Object.fromEntries(
      attributes.map(([key, entity]) => {
        try {
          return [key, resolveEntitySchema(entity, schemas)];
        } catch {
          return [key, entity];
        }
      }),
    ),
    events: Object.fromEntries(
      events.map(([key, entity]) => {
        try {
          return [key, resolveEntitySchema(entity, schemas)];
        } catch {
          return [key, entity];
        }
      }),
    ),
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
  const schemasByKey = await loadSchemas(datasource);
  const lintContext = await createLintContext(options, schemasByKey);

  let hasErrors = false;

  console.log("");
  console.log(CLI_FORMAT_BOLD, "Linting Eventvisor project");
  const printSection = (label: string) =>
    console.log(`  ${colorize("•", CLI_COLOR_CYAN)} Linting ${label}`);

  if (
    typeof projectConfig.onValidationFailure === "object" &&
    !lintContext.destinations[projectConfig.onValidationFailure.destination]
  ) {
    console.log(
      `  ${colorize("×", 31)} Project onValidationFailure references missing destination "${projectConfig.onValidationFailure.destination}"`,
    );
    hasErrors = true;
  }

  // reusable schemas
  printSection("schemas");
  for (const schemaKey of Object.keys(schemasByKey)) {
    if (entityType && entityType !== "schema") continue;
    if (keyPattern && !schemaKey.includes(keyPattern)) continue;
    const result = await JSONZodSchema.extend({
      promotable: z.boolean().optional(),
    }).safeParseAsync(schemasByKey[schemaKey]);
    if (!result.success) {
      printError({
        entityType: "schema",
        entityKey: schemaKey,
        error: result.error,
        projectConfig,
      });
      hasErrors = true;
      continue;
    }
    try {
      resolveSchema(result.data, schemasByKey);
    } catch (error) {
      printError({
        entityType: "schema",
        entityKey: schemaKey,
        error: schemaReferenceError(error),
        projectConfig,
      });
      hasErrors = true;
    }
  }

  // attributes
  printSection("attributes");

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

    let resolvedAttribute;
    try {
      resolvedAttribute = resolveEntitySchema(result.data, schemasByKey);
    } catch (error) {
      printError({
        entityType: "attribute",
        entityKey: attributeKey,
        error: schemaReferenceError(error),
        projectConfig,
      });
      hasErrors = true;
      continue;
    }
    const semanticIssues = getSemanticIssues("attribute", resolvedAttribute as any, lintContext);

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
  printSection("events");

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

    let resolvedEvent;
    try {
      resolvedEvent = resolveEntitySchema(result.data, schemasByKey);
    } catch (error) {
      printError({
        entityType: "event",
        entityKey: eventKey,
        error: schemaReferenceError(error),
        projectConfig,
      });
      hasErrors = true;
      continue;
    }
    const semanticIssues = getSemanticIssues("event", resolvedEvent as any, lintContext);

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
  printSection("destinations");

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
  printSection("effects");

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
  printSection("tests");

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

  printSection("targets");
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

  console.log("");
  console.log(CLI_FORMAT_GREEN, "✔ No lint errors found");
  console.log("");
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
