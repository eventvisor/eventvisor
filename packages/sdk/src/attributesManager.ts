import type { AttributeName, Value } from "@eventvisor/types";

import type { GetDatafileReader } from "./datafileReader";
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
  getDatafileReader: GetDatafileReader;
  getTransformer: GetTransformer;
  getConditionsChecker: GetConditionsChecker;
  validator: Validator;
  modulesManager: ModulesManager;
}

export class AttributesManager {
  private logger: Logger;
  private getDatafileReader: GetDatafileReader;
  private emitter: Emitter;
  private getTransformer: GetTransformer;
  private getConditionsChecker: GetConditionsChecker;
  private validator: Validator;
  private modulesManager: ModulesManager;

  private attributesMap: AttributesMap;

  constructor(options: AttributesManagerOptions) {
    const {
      logger,
      getDatafileReader,
      emitter,
      getTransformer,
      getConditionsChecker,
      validator,
      modulesManager,
    } = options;

    this.logger = logger;
    this.getDatafileReader = getDatafileReader;
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
    const datafileReader = this.getDatafileReader();

    const result = await initializeFromStorage({
      datafileReader,
      conditionsChecker: this.getConditionsChecker(),
      modulesManager: this.modulesManager,
      storageKeyPrefix: "attributes_",
      getEntityNames: () => datafileReader.getAttributeNames(),
      getEntity: (entityName: string) => datafileReader.getAttribute(entityName),
    });

    this.attributesMap = result;
  }

  async setAttribute(attributeName: AttributeName, value: Value): Promise<Value | null> {
    const datafileReader = this.getDatafileReader();

    /**
     * Find
     */
    const attributeSchema = datafileReader.getAttribute(attributeName);

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
      datafileReader,
      conditionsChecker: this.getConditionsChecker(),
      modulesManager: this.modulesManager,
      storageKeyPrefix: "attributes_",
      entityName: attributeName,
      entity: attributeSchema,
      value,
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
    return this.attributesMap[attributeName] || null;
  }

  async removeAttribute(attributeName: AttributeName): Promise<void> {
    const datafileReader = this.getDatafileReader();

    await removeEntity({
      datafileReader,
      conditionsChecker: this.getConditionsChecker(),
      modulesManager: this.modulesManager,
      storageKeyPrefix: "attributes_",
      entityName: attributeName,
      entity: datafileReader.getAttribute(attributeName),
    });

    delete this.attributesMap[attributeName];

    this.emitter.trigger("attribute_removed", {
      attributeName,
    });
  }
}
