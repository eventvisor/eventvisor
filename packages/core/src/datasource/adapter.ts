import type { DatafileContent, EntityType } from "@eventvisor/types";

export interface DatafileOptions {
  tag: string;
  datafilesDir?: string;
}

export abstract class Adapter {
  // entities
  abstract listEntities(entityType: EntityType): Promise<string[]>;
  abstract entityExists(entityType: EntityType, entityKey: string): Promise<boolean>;
  abstract readEntity<T>(entityType: EntityType, entityKey: string): Promise<T>;
  abstract writeEntity<T>(entityType: EntityType, entityKey: string, entity: T): Promise<T>;
  abstract deleteEntity(entityType: EntityType, entityKey: string): Promise<void>;

  // datafile
  abstract readDatafile(options: DatafileOptions): Promise<DatafileContent>;
  abstract writeDatafile(datafileContent: DatafileContent, options: DatafileOptions): Promise<void>;

  // revision
  abstract readRevision(): Promise<string>;
  abstract writeRevision(revision: string): Promise<void>;
}
