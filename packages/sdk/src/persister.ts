import type { Attribute, Effect, Value, ComplexPersist } from "@eventvisor/types";
import type { DatafileReader } from "./datafileReader";
import type { ConditionsChecker } from "./conditions";
import type { ModulesManager } from "./modulesManager";

export type EntityMap = Record<string, Value>;

export interface InitializeFromStorageOptions {
  datafileReader: DatafileReader;
  conditionsChecker: ConditionsChecker;
  modulesManager: ModulesManager;
  storageKeyPrefix: string;
  getEntityNames: () => string[];
  getEntity: (entityName: string) => Attribute | Effect | undefined;
}

export interface FindPersistOptions {
  persists: ComplexPersist[];
  entityName: string;
  conditionsChecker: ConditionsChecker;
  payload: Value;
}

export async function findPersist(
  options: FindPersistOptions,
): Promise<ComplexPersist | undefined> {
  const { persists, entityName, conditionsChecker, payload } = options;

  for (const persist of persists) {
    if (!persist.conditions) {
      return persist;
    }

    const isMatched = await conditionsChecker.allAreMatched(persist.conditions, {
      attributeName: entityName,
      effectName: entityName,
      payload,
    });

    if (isMatched) {
      return persist;
    }
  }
}

export async function initializeFromStorage({
  datafileReader,
  conditionsChecker,
  modulesManager,
  storageKeyPrefix,
  getEntityNames,
  getEntity,
}: InitializeFromStorageOptions): Promise<EntityMap> {
  const entityNames = getEntityNames();
  const entityMap: EntityMap = {};

  for (const entityName of entityNames) {
    const schema = getEntity(entityName);

    if (!schema) {
      continue;
    }

    const persists = datafileReader.getPersists(schema);

    if (!persists) {
      continue;
    }

    const persist = await findPersist({ persists, entityName, conditionsChecker, payload: {} });

    if (!persist) {
      continue;
    }

    // read from storage
    const value = await modulesManager.readFromStorage(
      persist.storage,
      `${storageKeyPrefix}${entityName}`,
    );

    if (value !== null && value !== undefined) {
      entityMap[entityName] = value;
    }
  }

  return entityMap;
}

export interface PersistEntityOptions {
  datafileReader: DatafileReader;
  conditionsChecker: ConditionsChecker;
  modulesManager: ModulesManager;
  storageKeyPrefix: string;
  entityName: string;
  entity: Attribute | Effect | undefined;
  value: Value;
}

export async function persistEntity({
  datafileReader,
  conditionsChecker,
  modulesManager,
  storageKeyPrefix,
  entityName,
  entity,
  value,
}: PersistEntityOptions) {
  if (!entity) {
    return;
  }

  const persists = datafileReader.getPersists(entity);

  if (!persists) {
    return;
  }

  const persist = await findPersist({ persists, entityName, conditionsChecker, payload: value });

  if (!persist) {
    return;
  }

  await modulesManager.writeToStorage(persist.storage, `${storageKeyPrefix}${entityName}`, value);
}

export interface RemoveEntityOptions {
  datafileReader: DatafileReader;
  conditionsChecker: ConditionsChecker;
  modulesManager: ModulesManager;
  storageKeyPrefix: string;
  entityName: string;
  entity: Attribute | Effect | undefined;
}

export async function removeEntity({
  datafileReader,
  conditionsChecker,
  modulesManager,
  storageKeyPrefix,
  entityName,
  entity,
}: RemoveEntityOptions) {
  if (!entity) {
    return;
  }

  const persists = datafileReader.getPersists(entity);

  if (!persists) {
    return;
  }

  const persist = await findPersist({ persists, entityName, conditionsChecker, payload: {} });

  if (!persist) {
    return;
  }

  await modulesManager.removeFromStorage(persist.storage, `${storageKeyPrefix}${entityName}`);
}
