import fs from "fs";
import path from "path";

import { Dependencies } from "../../dependencies";
import { generateInterface } from "./generateInterface";

export function getInterfaceName(entityName: string, suffix: string = ""): string {
  return (
    entityName
      .replace(/[^a-zA-Z0-9]+/g, " ") // Replace all special characters with spaces
      .split(" ")
      .filter((word) => word.length > 0) // Remove empty strings
      .map((word) => {
        // Check if word already has mixed case (camelCase/PascalCase pattern)
        // This detects if there are both lowercase and uppercase letters in the word
        const hasLowercase = /[a-z]/.test(word);
        const hasUppercase = /[A-Z]/.test(word);
        const hasMixedCase = hasLowercase && hasUppercase;

        if (hasMixedCase) {
          // Preserve existing casing structure, just ensure first letter is uppercase
          return word.charAt(0).toUpperCase() + word.slice(1);
        }
        // Normal PascalCase transformation for words without mixed case
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      })
      .join("") + suffix
  );
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
  for (const attribute of attributes) {
    const parsedAttribute = await datasource.readAttribute(attribute);
    if (!parsedAttribute) {
      continue;
    }
    const interfaceName = getInterfaceName(attribute, "Attribute");
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
${generatedAttributes.map(({ entityName, interfaceName }) => `  ${entityName}: ${interfaceName};`).join("\n")}
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
  for (const event of events) {
    const parsedEvent = await datasource.readEvent(event);
    if (!parsedEvent) {
      continue;
    }
    const interfaceName = getInterfaceName(event, "Event");
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
${generatedEvents.map(({ entityName, interfaceName }) => `  ${entityName}: ${interfaceName};`).join("\n")}
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
