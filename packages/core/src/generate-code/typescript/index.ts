import * as fs from "fs";
import * as path from "path";

import { Dependencies } from "../../dependencies";
import { generateInterface } from "./generateInterface";

const VALID_TYPESCRIPT_IDENTIFIER_REGEX = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

function transformWordToPascalCase(word: string): string {
  const hasLowercase = /[a-z]/.test(word);
  const hasUppercase = /[A-Z]/.test(word);
  const hasMixedCase = hasLowercase && hasUppercase;

  if (hasMixedCase) {
    return word.charAt(0).toUpperCase() + word.slice(1);
  }

  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

export function getInterfaceName(entityName: string, suffix: string = ""): string {
  const segments = entityName
    .split("/")
    .filter((segment) => segment.length > 0)
    .map((segment) =>
      segment
        .replace(/[^a-zA-Z0-9]+/g, " ")
        .split(" ")
        .filter((word) => word.length > 0)
        .map(transformWordToPascalCase)
        .join(""),
    )
    .filter((segment) => segment.length > 0);

  if (segments.length === 0) {
    return suffix;
  }

  const interfaceName = segments.reduce((result, segment, index) => {
    if (index === 0) {
      return segment;
    }

    return `${result}Namespace${segment}`;
  }, "");

  return `${interfaceName}${suffix}`;
}

export function getTypeScriptPropertyKey(name: string): string {
  return VALID_TYPESCRIPT_IDENTIFIER_REGEX.test(name) ? name : JSON.stringify(name);
}

function createUniqueInterfaceNames(entityNames: string[], suffix: string): Map<string, string> {
  const usedInterfaceNames = new Set<string>();
  const interfaceNames = new Map<string, string>();

  for (const entityName of entityNames) {
    const baseInterfaceName = getInterfaceName(entityName, suffix);
    let candidateInterfaceName = baseInterfaceName;
    let counter = 2;

    while (usedInterfaceNames.has(candidateInterfaceName)) {
      candidateInterfaceName = `${baseInterfaceName}${counter}`;
      counter += 1;
    }

    usedInterfaceNames.add(candidateInterfaceName);
    interfaceNames.set(entityName, candidateInterfaceName);
  }

  return interfaceNames;
}

export async function generateTypeScriptCodeForProject(deps: Dependencies, outputPath: string) {
  const { datasource } = deps;

  /**
   * Attributes
   */
  const generatedAttributes: {
    entityName: string;
    interfaceName: string;
    code: string;
  }[] = [];

  const attributes = await datasource.listAttributes();
  const attributeInterfaceNames = createUniqueInterfaceNames(attributes, "Attribute");
  for (const attribute of attributes) {
    const parsedAttribute = await datasource.readAttribute(attribute);
    if (!parsedAttribute) {
      continue;
    }
    const interfaceName = attributeInterfaceNames.get(attribute)!;
    const interfaceCode = generateInterface(parsedAttribute, interfaceName);

    generatedAttributes.push({
      entityName: attribute,
      interfaceName,
      code: interfaceCode,
    });
  }

  const attributesCodePath = path.resolve(outputPath, "attributes.ts");
  let attributesContent = generatedAttributes
    .map(
      ({ entityName, code }) => `/**
 * ${entityName}
 */
${code}
`,
    )
    .join("\n");

  const allAttributesContent = `
/**
 * Attributes
 */
export interface Attributes {
${generatedAttributes
  .map(
    ({ entityName, interfaceName }) =>
      `  ${getTypeScriptPropertyKey(entityName)}: ${interfaceName};`,
  )
  .join("\n")}
}
`;

  attributesContent += allAttributesContent;

  fs.writeFileSync(attributesCodePath, attributesContent);

  /**
   * Events
   */
  const generatedEvents: {
    entityName: string;
    interfaceName: string;
    code: string;
  }[] = [];

  const events = await datasource.listEvents();
  const eventInterfaceNames = createUniqueInterfaceNames(events, "Event");
  for (const event of events) {
    const parsedEvent = await datasource.readEvent(event);
    if (!parsedEvent) {
      continue;
    }
    const interfaceName = eventInterfaceNames.get(event)!;
    const interfaceCode = generateInterface(parsedEvent, interfaceName);

    generatedEvents.push({
      entityName: event,
      interfaceName,
      code: interfaceCode,
    });
  }

  const eventsCodePath = path.resolve(outputPath, "events.ts");
  let eventsContent = generatedEvents
    .map(
      ({ entityName, code }) => `/**
 * ${entityName}
 */
${code}
`,
    )
    .join("\n");

  const allEventsContent = `
/**
 * Events
 */
export interface Events {
${generatedEvents
  .map(
    ({ entityName, interfaceName }) =>
      `  ${getTypeScriptPropertyKey(entityName)}: ${interfaceName};`,
  )
  .join("\n")}
}
`;

  eventsContent += allEventsContent;

  fs.writeFileSync(eventsCodePath, eventsContent);

  /**
   * Index
   */
  let indexContent = `import type { Eventvisor, Value } from "@eventvisor/sdk";

import type { Events } from "./events";
import type { Attributes } from "./attributes";

/**
 * Instance
 */
let instance: Eventvisor | null = null;

export function setInstance(instance: Eventvisor) {
  instance = instance;
}

/**
 * Event
 */
type TrackHandler = (eventName: string, payload: Value) => void;

let trackHandler: TrackHandler | null = null;

export function assignEventHandler(handler: TrackHandler | null) {
  trackHandler = handler;
}

export function track<K extends keyof Events>(eventName: K, payload: Events[K]): void {
  if (instance) {
    instance.track(eventName, payload as unknown as Value);
  }

  if (trackHandler) {
    trackHandler(eventName, payload as unknown as Value);
  }
}

/**
 * Attribute
 */

type SetAttributeHandler = (attributeName: string, value: Value) => void;

let setAttributeHandler: SetAttributeHandler | null = null;

export function assignAttributeHandler(handler: SetAttributeHandler | null) {
  setAttributeHandler = handler;
}

export function setAttribute<K extends keyof Attributes>(
  attributeName: K,
  value: Attributes[K],
): void {
  if (instance) {
    instance.setAttribute(attributeName, value as unknown as Value);
  }

  if (setAttributeHandler) {
    setAttributeHandler(attributeName, value as unknown as Value);
  }
}
`;

  const indexCodePath = path.resolve(outputPath, "index.ts");
  fs.writeFileSync(indexCodePath, indexContent);
}
