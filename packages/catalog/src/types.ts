import type { Test } from "@eventvisor/types";

export type CatalogEntityType =
  | "event"
  | "attribute"
  | "destination"
  | "effect"
  | "schema"
  | "target";
export type EntityPath =
  | "events"
  | "attributes"
  | "destinations"
  | "effects"
  | "schemas"
  | "targets";
export type GitProvider = "github" | "gitlab" | "bitbucket";

export interface LastModified {
  commit: string;
  author: string;
  timestamp: string;
}
export interface EntitySummary {
  key: string;
  href?: string;
  description?: string;
  archived?: boolean;
  deprecated?: boolean;
  tags?: string[];
  targets?: string[];
  lastModified?: LastModified;
  schemaType?: string;
  level?: string;
  transport?: string;
  requiredAttributeCount?: number;
  triggerCount?: number;
  selectionCount?: number;
}
export interface CatalogIndex {
  set: string;
  counts: Record<CatalogEntityType, number>;
  entities: Record<CatalogEntityType, EntitySummary[]>;
}
export interface CatalogManifest {
  schemaVersion: string;
  generatedAt: string;
  router?: "hash" | "browser";
  basePath?: string;
  sets: boolean;
  setKeys: string[];
  projectConfig: { tags: string[] };
  links?: {
    provider?: GitProvider;
    repository?: string;
    source?: string;
    commit?: string;
  };
  paths: { projectHistory: string; root?: string; sets?: Record<string, string> };
  counts: Record<string, Record<CatalogEntityType, number>>;
}
export interface HistoryEntity {
  type: CatalogEntityType;
  key: string;
  set?: string;
}
export interface HistoryEntry {
  commit: string;
  author: string;
  timestamp: string;
  set?: string;
  entities: HistoryEntity[];
}
export interface HistoryPage {
  page: number;
  pageSize: number;
  totalPages: number;
  entries: HistoryEntry[];
}
export interface EntityDetail {
  type: CatalogEntityType;
  key: string;
  entity: Record<string, any>;
  sourcePath?: string;
  lastModified?: LastModified;
  relationships?: Record<string, string[]>;
  tests?: Test[];
  historyPath?: string;
}
