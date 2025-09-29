import type { Source, SourceBase, Value, Inputs } from "@eventvisor/types";

import type { ModulesManager } from "./modulesManager";
import type { Logger } from "./logger";
import type { AttributesManager } from "./attributesManager";
import type { EffectsManager } from "./effectsManager";

export type GetSourceResolver = () => SourceResolver;

const SOURCE_PATH_SEPARATOR = ".";

export interface SourceResolverOptions {
  logger: Logger;
  modulesManager: ModulesManager;
  attributesManager: AttributesManager;
  effectsManager: EffectsManager;
}

export interface SourcePath {
  name: string;
  path: string[]; // dot-separated path after the name
  fullKey: string;
}

export type SourceOrigin = SourcePath & {
  originType: "attribute" | "attributes" | "effect" | "payload" | "lookup" | string;
};

function findValueAtPath(obj: any, path: string[]): any {
  return path.reduce((acc, part) => acc[part], obj);
}

// @TODO: redo it with a better approach
export class SourceResolver {
  private logger: Logger;

  private modulesManager: ModulesManager;
  private attributesManager: AttributesManager;
  private effectsManager: EffectsManager;

  constructor(options: SourceResolverOptions) {
    const { logger, modulesManager, attributesManager, effectsManager } = options;

    this.logger = logger;
    this.modulesManager = modulesManager;
    this.attributesManager = attributesManager;
    this.effectsManager = effectsManager;
  }

  getPath(p: string): SourcePath {
    const parts = p.split(SOURCE_PATH_SEPARATOR);

    return {
      name: parts[0],
      path: parts.slice(1),
      fullKey: p,
    };
  }

  getOrigin(source: Source | Partial<SourceBase>): SourceOrigin | SourceOrigin[] | null {
    if (typeof source === "string") {
      const parts = source.split(SOURCE_PATH_SEPARATOR);
      const originType = parts[0] as SourceOrigin["originType"];

      // @TODO: validate type as one of known types

      return {
        originType,
        name: parts[1],
        path: parts.slice(2),
        fullKey: source,
      };
    }

    // @TODO: fix it better
    if ("source" in source) {
      return this.getOrigin(source.source as string);
    }

    if ("source" in source) {
      return this.getOrigin(source.source as string);
    }

    if ("attribute" in source) {
      return {
        originType: "attribute",
        ...this.getPath(source.attribute as string), // @TODO: consider array of strings here
      };
    }

    if ("effect" in source) {
      return {
        originType: "effect",
        ...this.getPath(source.effect as string),
      };
    }

    if ("payload" in source) {
      if (Array.isArray(source.payload)) {
        return source.payload.map((p) => ({
          originType: "payload",
          ...this.getPath(p as string),
        }));
      } else {
        return {
          originType: "payload",
          ...this.getPath(source.payload as string),
        };
      }
    }

    if ("lookup" in source) {
      return {
        originType: "lookup",
        ...this.getPath(source.lookup as string),
      };
    }

    if ("state" in source) {
      return {
        originType: "state",
        ...this.getPath(source.state as string),
      };
    }

    return null;
  }

  async resolveByOrigin(origin: SourceOrigin | null, inputs: Inputs = {}): Promise<Value> {
    if (origin === null) {
      return null;
    }

    if (origin.originType === "attributes") {
      const result = origin.name
        ? this.attributesManager.getAttributeValue(origin.name)
        : this.attributesManager.getAttributesMap();

      if (origin.path.length > 0) {
        return findValueAtPath(result, origin.path);
      }

      return result;
    }

    if (origin.originType === "attribute") {
      const result = this.attributesManager.getAttributeValue(origin.name);

      if (origin.path.length > 0) {
        return findValueAtPath(result, origin.path);
      }

      return result;
    }

    if (origin.originType === "effects") {
      const result = origin.name
        ? this.effectsManager.getStateValue(origin.name)
        : this.effectsManager.getAllStates();

      if (origin.path.length > 0) {
        return findValueAtPath(result, origin.path);
      }

      return result;
    }

    if (origin.originType === "effect") {
      const result = this.effectsManager.getStateValue(origin.name);

      if (origin.path.length > 0) {
        return findValueAtPath(result, origin.path);
      }

      return result;
    }

    if (origin.originType === "lookup") {
      return this.modulesManager.lookup(origin.fullKey);
    }

    // if (origin.originType === "payload" && inputs.payload) {
    //   return findValueAtPath(inputs.payload, [...origin.path, ...[origin.name]]); // @TODO: make it better
    // }

    // if (origin.originType === "attributes" && inputs.attributes) {
    //   const p = [...origin.path, ...[origin.name]].filter(Boolean);
    //   return findValueAtPath(inputs["attributes"], p); // @TODO: make it better
    // }

    // handle any other input that is not known early
    if (typeof inputs[origin.originType] !== "undefined") {
      return findValueAtPath(
        inputs[origin.originType],
        [...[origin.name, ...origin.path]].filter(Boolean),
      ); // @TODO: make it better
    }

    return null;
  }

  async resolve(source: Source | Partial<SourceBase>, inputs: Inputs = {}): Promise<Value> {
    const origin = this.getOrigin(source);

    if (Array.isArray(origin)) {
      return Promise.all(origin.map((o) => this.resolveByOrigin(o, inputs)));
    }

    const result = await this.resolveByOrigin(origin, inputs);

    return result;
  }
}
