import type { AttributeName, Value } from "@eventvisor/types";

import type { InstanceDataProvider } from "./datafile";
import type { GetConditionsChecker } from "./conditions";
import type { ModulesManager } from "./modulesManager";
import type { Emitter } from "./emitter";
import type { Logger } from "./logger";
import type { GetTransformer } from "./transformer";
import type { Validator } from "./validator";
import { initializeFromStorage, persistEntity, removeEntity } from "./persister";

export type AttributesMap = Record<AttributeName, Value>;

export interface AttributesManagerOptions {
  logger: Logger;
  emitter: Emitter;
  getDataProvider: () => InstanceDataProvider;
  getTransformer: GetTransformer;
  getConditionsChecker: GetConditionsChecker;
  validator: Validator;
  modulesManager: ModulesManager;
}

export class AttributesManager {
  private logger: Logger;
  private getDataProvider: () => InstanceDataProvider;
  private emitter: Emitter;
  private getTransformer: GetTransformer;
  private getConditionsChecker: GetConditionsChecker;
  private validator: Validator;
  private modulesManager: ModulesManager;

  private attributesMap: AttributesMap;

  constructor(options: AttributesManagerOptions) {
    const {
      logger,
      getDataProvider,
      emitter,
      getTransformer,
      getConditionsChecker,
      validator,
      modulesManager,
    } = options;

    this.logger = logger;
    this.getDataProvider = getDataProvider;
    this.emitter = emitter;
    this.getTransformer = getTransformer;
    this.getConditionsChecker = getConditionsChecker;
    this.validator = validator;
    this.modulesManager = modulesManager;

    // @TODO: initial attributes from SDK options
    this.attributesMap = {};
  }

  async initialize(): Promise<void> {
    // read form storage
    await this.initializeFromStorage();
  }

  private async initializeFromStorage(): Promise<void> {
    const dataProvider = this.getDataProvider();

    const result = await initializeFromStorage({
      dataProvider,
      conditionsChecker: this.getConditionsChecker(),
      modulesManager: this.modulesManager,
      storageKeyPrefix: "attributes_",
      getEntityNames: () => dataProvider.getAttributeNames(),
      getEntity: (entityName: string) => dataProvider.getAttribute(entityName),
    });

    this.attributesMap = result;
  }

  async setAttribute(attributeName: AttributeName, value: Value): Promise<Value | null> {
    const dataProvider = this.getDataProvider();

    /**
     * Find
     */
    const attributeSchema = dataProvider.getAttribute(attributeName);

    if (!attributeSchema) {
      this.logger.error(`Attribute schema not found`, {
        attributeName,
      });

      return null;
    }

    /**
     * Deprecated
     */
    if (attributeSchema.deprecated) {
      this.logger.warn(`Attribute is deprecated`, { attributeName });
    }

    /**
     * Validate
     */
    const validationResult = await this.validator.validate(attributeSchema, value);

    if (!validationResult.valid) {
      this.logger.warn(`Attribute validation failed`, {
        attributeName,
        errors: validationResult.errors,
      });

      return null;
    }

    const validatedValue = validationResult.value;

    /**
     * Transform
     */
    const transformedValue = attributeSchema.transforms
      ? await this.getTransformer().applyAll(validatedValue, attributeSchema.transforms, {
          payload: validatedValue,
          attributeName,
        })
      : validatedValue;

    /**
     * Set
     */
    this.attributesMap[attributeName] = transformedValue;

    this.emitter.trigger("attribute_set", { attributeName });
    this.logger.debug(`Attribute set`, { attributeName });

    /**
     * Persist
     */
    await persistEntity({
      dataProvider,
      conditionsChecker: this.getConditionsChecker(),
      modulesManager: this.modulesManager,
      storageKeyPrefix: "attributes_",
      entityName: attributeName,
      entity: attributeSchema,
      value: transformedValue,
    });

    return transformedValue;
  }

  isAttributeSet(attributeName: AttributeName): boolean {
    return this.attributesMap[attributeName] !== undefined;
  }

  getAttributesMap(): AttributesMap {
    return this.attributesMap;
  }

  getAttributeValue(attributeName: AttributeName): Value | null {
    return Object.prototype.hasOwnProperty.call(this.attributesMap, attributeName)
      ? this.attributesMap[attributeName]
      : null;
  }

  async refresh() {
    const activeNames = new Set(this.getDataProvider().getAttributeNames());
    const current = this.attributesMap;
    await this.initializeFromStorage();
    activeNames.forEach((name) => {
      if (Object.prototype.hasOwnProperty.call(current, name))
        this.attributesMap[name] = current[name];
    });
  }

  async removeAttribute(attributeName: AttributeName): Promise<void> {
    const dataProvider = this.getDataProvider();

    await removeEntity({
      dataProvider,
      conditionsChecker: this.getConditionsChecker(),
      modulesManager: this.modulesManager,
      storageKeyPrefix: "attributes_",
      entityName: attributeName,
      entity: dataProvider.getAttribute(attributeName),
    });

    delete this.attributesMap[attributeName];

    this.emitter.trigger("attribute_removed", {
      attributeName,
    });
  }
}
