import type { CatalogEntityType, EntityPath } from "./types";

export const entityPaths: EntityPath[] = [
  "events",
  "attributes",
  "destinations",
  "effects",
  "targets",
];
export const entityPathToType: Record<EntityPath, CatalogEntityType> = {
  events: "event",
  attributes: "attribute",
  destinations: "destination",
  effects: "effect",
  targets: "target",
};
export const entityTypeToPath: Record<CatalogEntityType, EntityPath> = {
  event: "events",
  attribute: "attributes",
  destination: "destinations",
  effect: "effects",
  target: "targets",
};
export const entityLabels: Record<CatalogEntityType, { singular: string; plural: string }> = {
  event: { singular: "Event", plural: "Events" },
  attribute: { singular: "Attribute", plural: "Attributes" },
  destination: { singular: "Destination", plural: "Destinations" },
  effect: { singular: "Effect", plural: "Effects" },
  target: { singular: "Target", plural: "Targets" },
};
export function encodeRouteSegment(value: string) {
  return encodeURIComponent(value).replace(/%2F/gi, "%252F");
}
export function decodeRouteSegment(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
export function encodeDataPath(value: string) {
  return value.split("/").map(encodeURIComponent).join("/");
}
export function getBasePath(set?: string) {
  return set ? `/sets/${encodeRouteSegment(set)}` : "";
}
export function getEntityRoute(type: CatalogEntityType, key: string, set?: string) {
  return `${getBasePath(set)}/${entityTypeToPath[type]}/${encodeRouteSegment(key)}`;
}
export function getDataBasePath(set?: string) {
  return set ? `/data/sets/${encodeURIComponent(set)}` : "/data/root";
}
export function sortSetKeys(keys: string[]) {
  const rank = (key: string) =>
    key.toLowerCase().startsWith("dev") ? 0 : key.toLowerCase().startsWith("prod") ? 2 : 1;
  return keys.slice().sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
}
