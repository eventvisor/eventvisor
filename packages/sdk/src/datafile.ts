import type {
  Attribute,
  AttributeName,
  ComplexPersist,
  DatafileContent,
  Destination,
  DestinationName,
  Effect,
  EffectName,
  Event,
  EventName,
  Persist,
} from "@eventvisor/types";

export type DatafileInput = DatafileContent | string;

export const emptyDatafile: DatafileContent = {
  schemaVersion: "1",
  revision: "0",
  attributes: {},
  events: {},
  destinations: {},
  effects: {},
};

export interface InstanceDataProvider {
  getSchemaVersion(): string;
  getRevision(): string;
  getAttribute(name: AttributeName): Attribute | undefined;
  getAttributeNames(): AttributeName[];
  getEvent(name: EventName): Event | undefined;
  getDestination(name: DestinationName): Destination | undefined;
  getDestinationNames(): DestinationName[];
  getEffect(name: EffectName): Effect | undefined;
  getEffectNames(): EffectName[];
  getRegex(pattern: string, flags?: string): RegExp;
  getPersists(schema: Attribute | Effect): ComplexPersist[] | null;
}

export function parseDatafile(input: DatafileInput): DatafileContent {
  if (typeof input !== "string") return input;
  try {
    return JSON.parse(input) as DatafileContent;
  } catch (error) {
    throw new Error(`Could not parse datafile: ${(error as Error).message}`);
  }
}

export function mergeDatafiles(
  current: DatafileContent,
  incoming: DatafileContent,
): DatafileContent {
  return {
    ...current,
    ...incoming,
    attributes: { ...current.attributes, ...incoming.attributes },
    events: { ...current.events, ...incoming.events },
    destinations: { ...current.destinations, ...incoming.destinations },
    effects: { ...current.effects, ...incoming.effects },
  };
}

export function getComplexPersists(persist: Persist): ComplexPersist[] {
  if (typeof persist === "string") return [{ storage: persist }];
  if (Array.isArray(persist)) {
    return persist.reduce<ComplexPersist[]>((all, entry) => {
      return all.concat(getComplexPersists(entry));
    }, []);
  }
  return [persist];
}
