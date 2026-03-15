import * as z from "zod";

import type {
  Attribute,
  Destination,
  Effect,
  Event,
  JSONSchema,
  Test,
  Transform,
  Condition,
  Sample,
  Value,
} from "@eventvisor/types";

export interface LintContext {
  attributes: Record<string, Attribute>;
  events: Record<string, Event>;
  destinations: Record<string, Destination>;
  effects: Record<string, Effect>;
}

type EntityType = "attribute" | "event" | "destination" | "effect" | "test";

interface ValidationState {
  issues: z.ZodIssue[];
  ctx: LintContext;
}

interface SourceValidationOptions {
  path: (string | number)[];
  allowedOrigins: Set<string>;
  payloadSchemas?: JSONSchema[];
  stateValue?: Value;
  allowPayloadArrays?: boolean;
  validateTargetAgainstPayload?: boolean;
  validateTargetAgainstState?: boolean;
}

const conditionStringWildcard = "*";

function pushIssue(
  state: ValidationState,
  path: (string | number)[],
  message: string,
) {
  state.issues.push({
    code: "custom",
    path,
    message,
  });
}

function parseDottedReference(ref: string) {
  const parts = ref.split(".");

  return {
    origin: parts[0],
    name: parts[1],
    path: parts.slice(2),
  };
}

function isObjectValue(value: Value | undefined): value is Record<string, Value> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getSchemaAtPath(
  schema: JSONSchema | undefined,
  pathParts: string[],
): JSONSchema | undefined {
  let current = schema;

  for (const part of pathParts) {
    if (!current) {
      return undefined;
    }

    if (current.type === "array" && current.items && !Array.isArray(current.items)) {
      current = current.items;
      if (part === "") {
        continue;
      }
      if (/^\d+$/.test(part)) {
        continue;
      }
    }

    if (current.properties && current.properties[part]) {
      current = current.properties[part];
      continue;
    }

    if (current.type === "array" && current.items && Array.isArray(current.items)) {
      const index = Number(part);
      if (!Number.isInteger(index)) {
        return undefined;
      }
      current = current.items[index];
      continue;
    }

    return undefined;
  }

  return current;
}

function valueHasPath(value: Value | undefined, pathParts: string[]): boolean {
  let current = value;

  for (const part of pathParts) {
    if (Array.isArray(current) && /^\d+$/.test(part)) {
      current = current[Number(part)];
      continue;
    }

    if (isObjectValue(current) && Object.prototype.hasOwnProperty.call(current, part)) {
      current = current[part];
      continue;
    }

    return false;
  }

  return true;
}

function validatePayloadPath(
  state: ValidationState,
  payloadSchemas: JSONSchema[] | undefined,
  pathParts: string[],
  issuePath: (string | number)[],
  label: string,
) {
  if (!payloadSchemas || payloadSchemas.length === 0 || pathParts.length === 0) {
    return;
  }

  const missingFor = payloadSchemas.filter((schema) => !getSchemaAtPath(schema, pathParts));

  if (missingFor.length > 0) {
    pushIssue(
      state,
      issuePath,
      `${label} references payload path "${pathParts.join(".")}" that is not defined in the referenced schema`,
    );
  }
}

function validateTargetPath(
  state: ValidationState,
  target: string,
  options: SourceValidationOptions,
  issuePath: (string | number)[],
) {
  const targetPath = target.split(".").filter(Boolean);

  if (targetPath.length === 0) {
    return;
  }

  if (options.validateTargetAgainstPayload) {
    // Eventvisor intentionally allows introducing new top-level fields during transforms,
    // but nested writes should still honor the declared object structure.
    if (targetPath.length > 1) {
      validatePayloadPath(
        state,
        options.payloadSchemas,
        targetPath,
        issuePath,
        `Transform target "${target}"`,
      );
    }
  }

  if (
    options.validateTargetAgainstState &&
    options.stateValue !== undefined &&
    !valueHasPath(options.stateValue, targetPath)
  ) {
    pushIssue(
      state,
      issuePath,
      `Transform target "${target}" is not declared in the effect state`,
    );
  }
}

function validateLookupKey(
  state: ValidationState,
  lookupKey: string,
  issuePath: (string | number)[],
) {
  const parts = lookupKey.split(".");

  if (parts.length < 2 || !parts[0] || parts.slice(1).join(".").length === 0) {
    pushIssue(
      state,
      issuePath,
      `Lookup reference "${lookupKey}" must include both module and key, for example "browser.screen.width"`,
    );
  }
}

function validateEntityReference(
  state: ValidationState,
  entityType: "attribute" | "event" | "destination" | "effect",
  entityName: string | undefined,
  issuePath: (string | number)[],
  label: string,
) {
  if (!entityName) {
    pushIssue(state, issuePath, `${label} must include an entity name`);
    return;
  }

  const collection =
    entityType === "attribute"
      ? state.ctx.attributes
      : entityType === "event"
        ? state.ctx.events
        : entityType === "destination"
          ? state.ctx.destinations
          : state.ctx.effects;

  if (!collection[entityName]) {
    pushIssue(
      state,
      issuePath,
      `${label} references missing ${entityType} "${entityName}"`,
    );
  }
}

function validateSourceString(
  state: ValidationState,
  source: string,
  options: SourceValidationOptions,
) {
  const parsed = parseDottedReference(source);

  if (!options.allowedOrigins.has(parsed.origin)) {
    pushIssue(
      state,
      options.path,
      `Source origin "${parsed.origin}" is not available in this context`,
    );
    return;
  }

  if (parsed.origin === "attributes" || parsed.origin === "attribute") {
    if (parsed.origin === "attributes" && !parsed.name) {
      return;
    }
    validateEntityReference(state, "attribute", parsed.name, options.path, `Source "${source}"`);
    return;
  }

  if (parsed.origin === "effects" || parsed.origin === "effect") {
    if (parsed.origin === "effects" && !parsed.name) {
      return;
    }
    validateEntityReference(state, "effect", parsed.name, options.path, `Source "${source}"`);
    return;
  }

  if (parsed.origin === "payload") {
    const payloadPath = parsed.name ? [parsed.name, ...parsed.path] : parsed.path;
    validatePayloadPath(state, options.payloadSchemas, payloadPath, options.path, `Source "${source}"`);
    return;
  }

  if (parsed.origin === "lookup") {
    validateLookupKey(state, source, options.path);
    return;
  }

  if (parsed.origin === "state" && parsed.name) {
    const statePath = [parsed.name, ...parsed.path];
    if (options.stateValue !== undefined && !valueHasPath(options.stateValue, statePath)) {
      pushIssue(
        state,
        options.path,
        `Source "${source}" references missing state path "${statePath.join(".")}"`,
      );
    }
  }
}

function validateSourceBase(
  state: ValidationState,
  sourceBase: Record<string, any>,
  options: SourceValidationOptions,
) {
  if (typeof sourceBase.source !== "undefined") {
    if (Array.isArray(sourceBase.source)) {
      pushIssue(
        state,
        [...options.path, "source"],
        `The "source" field does not support arrays; use "payload" for multi-source payload references`,
      );
    } else {
      validateSourceString(state, sourceBase.source, {
        ...options,
        path: [...options.path, "source"],
      });
    }
  }

  if (typeof sourceBase.payload !== "undefined") {
    const payloadValue = sourceBase.payload;
    const payloadPaths = Array.isArray(payloadValue) ? payloadValue : [payloadValue];

    if (Array.isArray(payloadValue) && !options.allowPayloadArrays) {
      pushIssue(
        state,
        [...options.path, "payload"],
        `The "payload" field does not support arrays in this context`,
      );
    }

    for (let index = 0; index < payloadPaths.length; index++) {
      const payloadPath = payloadPaths[index];
      const issuePath = Array.isArray(payloadValue)
        ? [...options.path, "payload", index]
        : [...options.path, "payload"];

      validatePayloadPath(
        state,
        options.payloadSchemas,
        String(payloadPath).split(".").filter(Boolean),
        issuePath,
        `Payload reference "${payloadPath}"`,
      );
    }
  }

  if (typeof sourceBase.lookup !== "undefined") {
    if (Array.isArray(sourceBase.lookup)) {
      pushIssue(state, [...options.path, "lookup"], `The "lookup" field must be a single string`);
    } else {
      validateLookupKey(state, String(sourceBase.lookup), [...options.path, "lookup"]);
    }
  }

  if (typeof sourceBase.attribute !== "undefined") {
    if (Array.isArray(sourceBase.attribute)) {
      pushIssue(
        state,
        [...options.path, "attribute"],
        `The "attribute" field must reference a single attribute`,
      );
    } else {
      validateEntityReference(
        state,
        "attribute",
        String(sourceBase.attribute).split(".")[0],
        [...options.path, "attribute"],
        `Attribute reference "${sourceBase.attribute}"`,
      );
    }
  }

  if (typeof sourceBase.effect !== "undefined") {
    if (Array.isArray(sourceBase.effect)) {
      pushIssue(
        state,
        [...options.path, "effect"],
        `The "effect" field must reference a single effect`,
      );
    } else {
      validateEntityReference(
        state,
        "effect",
        String(sourceBase.effect).split(".")[0],
        [...options.path, "effect"],
        `Effect reference "${sourceBase.effect}"`,
      );
    }
  }

  if (typeof sourceBase.state !== "undefined") {
    if (Array.isArray(sourceBase.state)) {
      pushIssue(state, [...options.path, "state"], `The "state" field must be a single path`);
    } else if (
      options.stateValue !== undefined &&
      !valueHasPath(options.stateValue, String(sourceBase.state).split("."))
    ) {
      pushIssue(
        state,
        [...options.path, "state"],
        `State reference "${sourceBase.state}" is not declared in the effect state`,
      );
    }
  }
}

function validateCondition(
  state: ValidationState,
  condition: Condition | Condition[],
  path: (string | number)[],
  options: SourceValidationOptions,
) {
  if (typeof condition === "string") {
    if (condition !== conditionStringWildcard) {
      pushIssue(
        state,
        path,
        `Only "*" is allowed as a string condition; use structured conditions instead`,
      );
    }
    return;
  }

  if (Array.isArray(condition)) {
    condition.forEach((item, index) => validateCondition(state, item, [...path, index], options));
    return;
  }

  if ("and" in condition) {
    condition.and.forEach((item, index) =>
      validateCondition(state, item, [...path, "and", index], options),
    );
    return;
  }

  if ("or" in condition) {
    condition.or.forEach((item, index) =>
      validateCondition(state, item, [...path, "or", index], options),
    );
    return;
  }

  if ("not" in condition) {
    condition.not.forEach((item, index) =>
      validateCondition(state, item, [...path, "not", index], options),
    );
    return;
  }

  validateSourceBase(state, condition as Record<string, any>, options);
}

function validateSample(
  state: ValidationState,
  sample: Sample | Sample[],
  path: (string | number)[],
  options: SourceValidationOptions,
) {
  const samples = Array.isArray(sample) ? sample : [sample];

  samples.forEach((singleSample, index) => {
    const samplePath = Array.isArray(sample) ? [...path, index] : path;

    if (typeof singleSample.by === "string") {
      validateSourceString(state, singleSample.by, { ...options, path: [...samplePath, "by"] });
    } else if (Array.isArray(singleSample.by)) {
      singleSample.by.forEach((byEntry, byIndex) => {
        if (typeof byEntry === "string") {
          validateSourceString(state, byEntry, {
            ...options,
            path: [...samplePath, "by", byIndex],
          });
        } else {
          validateSourceBase(state, byEntry, {
            ...options,
            path: [...samplePath, "by", byIndex],
          });
        }
      });
    } else if ("or" in singleSample.by) {
      singleSample.by.or.forEach((byEntry, byIndex) => {
        if (typeof byEntry === "string") {
          validateSourceString(state, byEntry, {
            ...options,
            path: [...samplePath, "by", "or", byIndex],
          });
        } else {
          validateSourceBase(state, byEntry, {
            ...options,
            path: [...samplePath, "by", "or", byIndex],
          });
        }
      });
    } else {
      validateSourceBase(state, singleSample.by, { ...options, path: [...samplePath, "by"] });
    }

    if (singleSample.conditions) {
      validateCondition(state, singleSample.conditions, [...samplePath, "conditions"], options);
    }
  });
}

function validateTransform(
  state: ValidationState,
  transform: Transform,
  path: (string | number)[],
  options: SourceValidationOptions,
) {
  validateSourceBase(state, transform as Record<string, any>, {
    ...options,
    path,
    allowPayloadArrays: transform.type === "concat",
  });

  if (
    ["rename"].includes(transform.type) &&
    (!transform.targetMap ||
      (Array.isArray(transform.targetMap) && transform.targetMap.length === 0) ||
      (!Array.isArray(transform.targetMap) && Object.keys(transform.targetMap).length === 0))
  ) {
    pushIssue(state, [...path, "targetMap"], `Transform "${transform.type}" requires a non-empty targetMap`);
  }

  if (["remove", "trim", "toInteger", "toDouble", "toString", "toBoolean"].includes(transform.type)) {
    if (!transform.target) {
      pushIssue(state, [...path, "target"], `Transform "${transform.type}" requires a target`);
    }
  }

  if (transform.type === "set" && !transform.target && typeof transform.value === "undefined") {
    pushIssue(
      state,
      path,
      `Transform "set" must define either a target or a value`,
    );
  }

  if (transform.type === "rename" && transform.target) {
    pushIssue(state, [...path, "target"], `Transform "rename" must use targetMap instead of target`);
  }

  if (transform.target) {
    const targets = Array.isArray(transform.target) ? transform.target : [transform.target];
    targets.forEach((target, index) => {
      validateTargetPath(
        state,
        String(target),
        options,
        Array.isArray(transform.target) ? [...path, "target", index] : [...path, "target"],
      );
    });
  }

  if (transform.targetMap && (options.validateTargetAgainstPayload || options.validateTargetAgainstState)) {
    const targetMaps = Array.isArray(transform.targetMap) ? transform.targetMap : [transform.targetMap];
    targetMaps.forEach((targetMap, mapIndex) => {
      Object.values(targetMap).forEach((targetPath) => {
        validateTargetPath(
          state,
          String(targetPath),
          options,
          Array.isArray(transform.targetMap)
            ? [...path, "targetMap", mapIndex]
            : [...path, "targetMap"],
        );
      });
    });
  }

  if (transform.targetMap && options.payloadSchemas && options.payloadSchemas.length > 0) {
    const targetMaps = Array.isArray(transform.targetMap) ? transform.targetMap : [transform.targetMap];
    targetMaps.forEach((targetMap, mapIndex) => {
      Object.keys(targetMap).forEach((sourceKey) => {
        validatePayloadPath(
          state,
          options.payloadSchemas,
          sourceKey.split("."),
          Array.isArray(transform.targetMap)
            ? [...path, "targetMap", mapIndex, sourceKey]
            : [...path, "targetMap", sourceKey],
          `Transform source "${sourceKey}"`,
        );
      });
    });
  }

  if (transform.conditions) {
    validateCondition(state, transform.conditions, [...path, "conditions"], options);
  }
}

function validatePersist(
  state: ValidationState,
  persist: Attribute["persist"] | Effect["persist"],
  path: (string | number)[],
  options: SourceValidationOptions,
) {
  if (!persist || typeof persist === "string") {
    return;
  }

  if (Array.isArray(persist)) {
    persist.forEach((item, index) => validatePersist(state, item, [...path, index], options));
    return;
  }

  if (persist.conditions) {
    validateCondition(state, persist.conditions, [...path, "conditions"], options);
  }
}

function validateAttributeSemantics(
  state: ValidationState,
  attribute: Attribute,
) {
  const options: SourceValidationOptions = {
    path: [],
    allowedOrigins: new Set(["attributes", "attribute", "effects", "effect", "payload", "lookup", "attributeName"]),
    payloadSchemas: [attribute],
    validateTargetAgainstPayload: true,
  };

  attribute.transforms?.forEach((transform, index) =>
    validateTransform(state, transform, ["transforms", index], options),
  );

  if (attribute.persist) {
    validatePersist(state, attribute.persist, ["persist"], options);
  }
}

function validateEventSemantics(
  state: ValidationState,
  event: Event,
) {
  const options: SourceValidationOptions = {
    path: [],
    allowedOrigins: new Set([
      "attributes",
      "attribute",
      "effects",
      "effect",
      "payload",
      "lookup",
      "eventName",
      "eventLevel",
    ]),
    payloadSchemas: [event],
    validateTargetAgainstPayload: true,
  };

  event.requiredAttributes?.forEach((attributeName, index) => {
    if (!state.ctx.attributes[attributeName]) {
      pushIssue(
        state,
        ["requiredAttributes", index],
        `requiredAttributes references missing attribute "${attributeName}"`,
      );
    }
  });

  if (event.conditions) {
    validateCondition(state, event.conditions, ["conditions"], options);
  }

  if (event.sample) {
    validateSample(state, event.sample, ["sample"], options);
  }

  event.transforms?.forEach((transform, index) =>
    validateTransform(state, transform, ["transforms", index], options),
  );

  if (event.skipValidation && typeof event.skipValidation === "object" && event.skipValidation.conditions) {
    validateCondition(state, event.skipValidation.conditions, ["skipValidation", "conditions"], options);
  }

  if (event.destinations) {
    Object.entries(event.destinations).forEach(([destinationName, destinationOverride]) => {
      if (!state.ctx.destinations[destinationName]) {
        pushIssue(
          state,
          ["destinations", destinationName],
          `destinations references missing destination "${destinationName}"`,
        );
      }

      if (destinationOverride && typeof destinationOverride === "object") {
        if (destinationOverride.conditions) {
          validateCondition(
            state,
            destinationOverride.conditions,
            ["destinations", destinationName, "conditions"],
            options,
          );
        }
        if (destinationOverride.sample) {
          validateSample(
            state,
            destinationOverride.sample,
            ["destinations", destinationName, "sample"],
            options,
          );
        }
        destinationOverride.transforms?.forEach((transform, index) =>
          validateTransform(
            state,
            transform,
            ["destinations", destinationName, "transforms", index],
            options,
          ),
        );
      }
    });
  }
}

function getEffectPayloadSchemas(state: ValidationState, effect: Effect): JSONSchema[] | undefined {
  if (!effect.on || Array.isArray(effect.on)) {
    return undefined;
  }

  const payloadSchemas: JSONSchema[] = [];

  effect.on.event_tracked?.forEach((eventName) => {
    const event = state.ctx.events[eventName];
    if (event) {
      payloadSchemas.push(event);
    }
  });

  effect.on.attribute_set?.forEach((attributeName) => {
    const attribute = state.ctx.attributes[attributeName];
    if (attribute) {
      payloadSchemas.push(attribute);
    }
  });

  return payloadSchemas.length > 0 ? payloadSchemas : undefined;
}

function validateEffectSemantics(
  state: ValidationState,
  effect: Effect,
) {
  if (!Array.isArray(effect.on)) {
    effect.on.event_tracked?.forEach((eventName, index) => {
      if (!state.ctx.events[eventName]) {
        pushIssue(
          state,
          ["on", "event_tracked", index],
          `Effect trigger references missing event "${eventName}"`,
        );
      }
    });

    effect.on.attribute_set?.forEach((attributeName, index) => {
      if (!state.ctx.attributes[attributeName]) {
        pushIssue(
          state,
          ["on", "attribute_set", index],
          `Effect trigger references missing attribute "${attributeName}"`,
        );
      }
    });
  }

  const conditionOptions: SourceValidationOptions = {
    path: [],
    allowedOrigins: new Set([
      "attributes",
      "attribute",
      "effects",
      "effect",
      "payload",
      "lookup",
      "eventName",
      "attributeName",
      "state",
    ]),
    payloadSchemas: getEffectPayloadSchemas(state, effect),
    stateValue: effect.state,
  };

  if (effect.conditions) {
    validateCondition(state, effect.conditions, ["conditions"], conditionOptions);
  }

  effect.steps?.forEach((step, stepIndex) => {
    if (step.conditions) {
      validateCondition(state, step.conditions, ["steps", stepIndex, "conditions"], conditionOptions);
    }

    step.transforms?.forEach((transform, transformIndex) =>
      validateTransform(
        state,
        transform,
        ["steps", stepIndex, "transforms", transformIndex],
        {
          path: [],
          allowedOrigins: new Set([
            "attributes",
            "attribute",
            "effects",
            "effect",
            "lookup",
            "eventName",
            "attributeName",
            "state",
          ]),
          stateValue: effect.state,
          validateTargetAgainstState: true,
        },
      ),
    );
  });

  if (effect.persist) {
    validatePersist(state, effect.persist, ["persist"], conditionOptions);
  }
}

function validateDestinationSemantics(
  state: ValidationState,
  destination: Destination,
) {
  const conditionOptions: SourceValidationOptions = {
    path: [],
    allowedOrigins: new Set([
      "attributes",
      "attribute",
      "effects",
      "effect",
      "payload",
      "lookup",
      "eventName",
      "eventLevel",
    ]),
  };

  const transformOptions: SourceValidationOptions = {
    path: [],
    allowedOrigins: new Set([
      "attributes",
      "attribute",
      "effects",
      "effect",
      "payload",
      "lookup",
      "eventName",
      "eventLevel",
      "destinationName",
    ]),
  };

  if (destination.conditions) {
    validateCondition(state, destination.conditions, ["conditions"], conditionOptions);
  }

  if (destination.sample) {
    validateSample(state, destination.sample, ["sample"], conditionOptions);
  }

  destination.transforms?.forEach((transform, index) =>
    validateTransform(state, transform, ["transforms", index], transformOptions),
  );
}

function validateTestSemantics(
  state: ValidationState,
  test: Test,
) {
  if ("attribute" in test && !state.ctx.attributes[test.attribute]) {
    pushIssue(state, ["attribute"], `Test references missing attribute "${test.attribute}"`);
  }

  if ("event" in test) {
    if (!state.ctx.events[test.event]) {
      pushIssue(state, ["event"], `Test references missing event "${test.event}"`);
    }

    test.assertions.forEach((assertion, index) => {
      assertion.expectedDestinations?.forEach((destinationName, destinationIndex) => {
        const destinationExists =
          !!state.ctx.destinations[destinationName] ||
          Object.values(state.ctx.destinations).some(
            (destination) => destination.transport === destinationName,
          );

        if (!destinationExists) {
          pushIssue(
            state,
            ["assertions", index, "expectedDestinations", destinationIndex],
            `expectedDestinations references missing destination "${destinationName}"`,
          );
        }
      });

      assertion.actions?.forEach((action, actionIndex) => {
        if (action.type === "track" && !state.ctx.events[action.name]) {
          pushIssue(
            state,
            ["assertions", index, "actions", actionIndex, "name"],
            `Action references missing event "${action.name}"`,
          );
        }

        if (action.type === "setAttribute" && !state.ctx.attributes[action.name]) {
          pushIssue(
            state,
            ["assertions", index, "actions", actionIndex, "name"],
            `Action references missing attribute "${action.name}"`,
          );
        }
      });
    });
  }

  if ("effect" in test && !state.ctx.effects[test.effect]) {
    pushIssue(state, ["effect"], `Test references missing effect "${test.effect}"`);
  }

  if ("destination" in test && !state.ctx.destinations[test.destination]) {
    pushIssue(state, ["destination"], `Test references missing destination "${test.destination}"`);
  }
}

export function getSemanticIssues(
  entityType: EntityType,
  entity: Attribute | Event | Destination | Effect | Test,
  ctx: LintContext,
): z.ZodIssue[] {
  const state: ValidationState = {
    issues: [],
    ctx,
  };

  if (entityType === "attribute") {
    validateAttributeSemantics(state, entity as Attribute);
  } else if (entityType === "event") {
    validateEventSemantics(state, entity as Event);
  } else if (entityType === "destination") {
    validateDestinationSemantics(state, entity as Destination);
  } else if (entityType === "effect") {
    validateEffectSemantics(state, entity as Effect);
  } else if (entityType === "test") {
    validateTestSemantics(state, entity as Test);
  }

  return state.issues;
}
