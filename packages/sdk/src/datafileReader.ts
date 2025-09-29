import {
  AttributeName,
  DatafileContent,
  DestinationName,
  EffectName,
  EventName,
  Persist,
  ComplexPersist,
  Attribute,
  Effect,
  Event,
  Destination,
} from "@eventvisor/types";

import { Logger } from "./logger";

export interface DatafileReaderOptions {
  datafile: DatafileContent;
  logger: Logger;
}

export type GetDatafileReader = () => DatafileReader;

export type GetRegex = (regexString: string, regexFlags?: string) => RegExp;

export const emptyDatafile: DatafileContent = {
  schemaVersion: "1",
  revision: "0",

  attributes: {},
  events: {},
  destinations: {},
  effects: {},
};

export function getComplexPersists(persist: Persist): ComplexPersist[] {
  let result: ComplexPersist[] = [];

  if (typeof persist === "string") {
    result.push({ storage: persist });
  } else if (Array.isArray(persist)) {
    for (const p of persist) {
      const r = getComplexPersists(p);

      if (r) {
        result = result.concat(r);
      }
    }
  } else if (typeof persist === "object") {
    result.push(persist);
  }

  return result;
}

export class DatafileReader {
  private schemaVersion: string;
  private revision: string;

  private datafile: DatafileContent;
  private logger: Logger;
  private regexCache: Record<string, RegExp>;

  constructor(options: DatafileReaderOptions) {
    const { datafile, logger } = options;

    this.datafile = datafile;
    this.schemaVersion = datafile.schemaVersion;
    this.revision = datafile.revision;

    this.regexCache = {};

    this.logger = logger;
  }

  getSchemaVersion(): string {
    return this.schemaVersion;
  }

  getRevision(): string {
    return this.revision;
  }

  getAttribute(attributeName: AttributeName): Attribute | undefined {
    return this.datafile.attributes[attributeName];
  }

  getAttributeNames(): AttributeName[] {
    return Object.keys(this.datafile.attributes);
  }

  getEvent(eventName: EventName): Event | undefined {
    return this.datafile.events[eventName];
  }

  getDestination(destinationName: DestinationName): Destination | undefined {
    return this.datafile.destinations[destinationName];
  }

  getDestinationNames(): DestinationName[] {
    return Object.keys(this.datafile.destinations);
  }

  getEffect(effectName: EffectName): Effect | undefined {
    return this.datafile.effects[effectName];
  }

  getEffectNames(): EffectName[] {
    return Object.keys(this.datafile.effects);
  }

  getRegex(regexString: string, regexFlags?: string): RegExp {
    const flags = regexFlags || "";
    const cacheKey = `${regexString}-${flags}`;

    if (this.regexCache[cacheKey]) {
      return this.regexCache[cacheKey];
    }

    const regex = new RegExp(regexString, flags);
    this.regexCache[cacheKey] = regex;

    return regex;
  }

  getPersists(schema: Attribute | Effect): ComplexPersist[] | null {
    if (!schema || !schema.persist) {
      return null;
    }

    return getComplexPersists(schema.persist);
  }
}
