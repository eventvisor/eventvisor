import type { Attribute, Effect, Value, ComplexPersist } from "@eventvisor/types";
import type { InstanceDataProvider } from "./datafile.js";
import type { ConditionsChecker } from "./conditions.js";
import type { ModulesManager } from "./modulesManager.js";

export type EntityMap = Record<string, Value>;

export interface InitializeFromStorageOptions {
  dataProvider: InstanceDataProvider;
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
  dataProvider,
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

    const persists = dataProvider.getPersists(schema);

    if (!persists) {
      continue;
    }

    // Conditions can depend on the persisted value, which is not available
    // until it has been read. Read configured stores in declaration order.
    for (const persist of persists) {
      const value = await modulesManager.readFromStorage(
        persist.storage,
        `${storageKeyPrefix}${entityName}`,
      );
      if (value !== null && value !== undefined) {
        entityMap[entityName] = value;
        break;
      }
    }
  }

  return entityMap;
}

export interface PersistEntityOptions {
  dataProvider: InstanceDataProvider;
  conditionsChecker: ConditionsChecker;
  modulesManager: ModulesManager;
  storageKeyPrefix: string;
  entityName: string;
  entity: Attribute | Effect | undefined;
  value: Value;
}

export async function persistEntity({
  dataProvider,
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

  const persists = dataProvider.getPersists(entity);

  if (!persists) {
    return;
  }

  const persist = await findPersist({ persists, entityName, conditionsChecker, payload: value });

  if (!persist) {
    return;
  }

  for (const candidate of persists) {
    if (candidate.storage !== persist.storage) {
      await modulesManager.removeFromStorage(candidate.storage, `${storageKeyPrefix}${entityName}`);
    }
  }
  await modulesManager.writeToStorage(persist.storage, `${storageKeyPrefix}${entityName}`, value);
}

export interface RemoveEntityOptions {
  dataProvider: InstanceDataProvider;
  conditionsChecker: ConditionsChecker;
  modulesManager: ModulesManager;
  storageKeyPrefix: string;
  entityName: string;
  entity: Attribute | Effect | undefined;
}

export async function removeEntity({
  dataProvider,
  modulesManager,
  storageKeyPrefix,
  entityName,
  entity,
}: RemoveEntityOptions) {
  if (!entity) {
    return;
  }

  const persists = dataProvider.getPersists(entity);

  if (!persists) {
    return;
  }

  for (const storage of [...new Set(persists.map((persist) => persist.storage))]) {
    await modulesManager.removeFromStorage(storage, `${storageKeyPrefix}${entityName}`);
  }
}
