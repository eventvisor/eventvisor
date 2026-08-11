import type { Source, SourceBase, Value, Inputs } from "@eventvisor/types";

import type { ModulesManager } from "./modulesManager.js";
import type { Logger } from "./logger.js";
import type { AttributesManager } from "./attributesManager.js";
import type { EffectsManager } from "./effectsManager.js";
import { getSafePathSegments, hasOwn } from "./portable.js";

export type GetSourceResolver = () => SourceResolver;

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
  return path.reduce((acc, part) => {
    if (
      acc === null ||
      acc === undefined ||
      !getSafePathSegments(part) ||
      (typeof acc === "object" && !hasOwn(acc, part))
    ) {
      return undefined;
    }

    return acc[part];
  }, obj);
}

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

  getPath(p: string): SourcePath | null {
    const parts = getSafePathSegments(p);
    if (!parts) return null;

    return {
      name: parts[0],
      path: parts.slice(1),
      fullKey: p,
    };
  }

  getOrigin(source: Source | Partial<SourceBase>): SourceOrigin | SourceOrigin[] | null {
    if (typeof source === "string") {
      const parts = getSafePathSegments(source);
      if (!parts) return null;
      const originType = parts[0] as SourceOrigin["originType"];

      return {
        originType,
        name: parts[1] || "",
        path: parts.slice(2),
        fullKey: source,
      };
    }

    const originTypes = ["source", "attribute", "state", "effect", "payload", "lookup"] as const;
    const selected = originTypes.filter((originType) => typeof source[originType] !== "undefined");
    if (selected.length !== 1) return null;

    for (const originType of originTypes) {
      const value = source[originType];
      if (typeof value === "undefined") continue;
      const values = Array.isArray(value) ? value : [value];
      const origins = values.map((entry) => {
        if (originType === "source") return this.getOrigin(entry) as SourceOrigin;
        const sourcePath = this.getPath(entry);
        return sourcePath ? ({ originType, ...sourcePath } as SourceOrigin) : null;
      });
      if (origins.some((origin) => origin === null)) return null;
      return Array.isArray(value) ? (origins as SourceOrigin[]) : origins[0];
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

    // Resolve payload and any additional operation-specific inputs.
    if (typeof inputs[origin.originType] !== "undefined") {
      return findValueAtPath(
        inputs[origin.originType],
        [...[origin.name, ...origin.path]].filter(Boolean),
      );
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
