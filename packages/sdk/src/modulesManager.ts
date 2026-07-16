import type {
  Value,
  Effect,
  Step,
  EventName,
  DestinationName,
  EffectName,
  EventLevel,
} from "@eventvisor/types";

import type { EventvisorDiagnostic, EventvisorDiagnosticHandler, Logger } from "./logger.js";

export type ModuleName = string;

export interface LookupOptions {
  key: string;
}

// export interface TransformOptions {
//   key: string;
//   value: Value;
// }

export interface HandleOptions {
  effectName: EffectName;
  effect: Effect;
  step: Step;
  payload: Value;
}

export interface TransportOptions {
  destinationName: DestinationName;
  eventName: EventName;
  eventLevel?: EventLevel;
  payload: Value;
  error?: Error;
}

export interface ReadFromStorageOptions {
  key: string;
}

export interface WriteToStorageOptions {
  key: string;
  value: Value;
}

export interface RemoveFromStorageOptions {
  key: string;
}

export interface EventvisorModuleApi {
  getRevision: () => string;
  onDiagnostic: (handler: EventvisorDiagnosticHandler) => () => void;
  reportDiagnostic: (diagnostic: EventvisorDiagnostic) => void;
}

export interface EventvisorModule {
  name: ModuleName;

  setup?: (api: EventvisorModuleApi) => void;
  close?: () => void | Promise<void>;

  lookup?: (options: LookupOptions, api: EventvisorModuleApi) => Promise<Value>;

  // @TODO: transform?: (options: TransformOptions, deps: ModuleDependencies) => Promise<Value>;

  handle?: (options: HandleOptions, api: EventvisorModuleApi) => Promise<void>;

  transport?: (options: TransportOptions, api: EventvisorModuleApi) => Promise<void>;

  readFromStorage?: (options: ReadFromStorageOptions, api: EventvisorModuleApi) => Promise<Value>;
  writeToStorage?: (options: WriteToStorageOptions, api: EventvisorModuleApi) => Promise<void>;
  removeFromStorage?: (
    options: RemoveFromStorageOptions,
    api: EventvisorModuleApi,
  ) => Promise<void>;
}

export interface ModulesManagerOptions {
  logger: Logger;
  getRevision: () => string;
  onDiagnostic: (handler: EventvisorDiagnosticHandler) => () => void;
  reportDiagnostic: (diagnostic: EventvisorDiagnostic) => void;
}

export class ModulesManager {
  private logger: Logger;
  private options: ModulesManagerOptions;

  // @TODO: can be optimized further by keeping only array of names, but keeping actual modules in an object
  private modules: EventvisorModule[];
  private diagnosticUnsubscribers: Record<string, (() => void)[]> = {};

  constructor(options: ModulesManagerOptions) {
    const { logger } = options;

    this.logger = logger;
    this.options = options;
    this.modules = [];
  }

  private clearDiagnosticSubscriptions(moduleName: string) {
    this.diagnosticUnsubscribers[moduleName]?.forEach((unsubscribe) => unsubscribe());
    delete this.diagnosticUnsubscribers[moduleName];
  }

  private async closeModule(module: EventvisorModule) {
    try {
      await module.close?.();
    } catch (error) {
      this.options.reportDiagnostic({
        level: "error",
        code: "module_close_failed",
        message: `Module ${module.name} close failed`,
        details: {},
        moduleName: module.name,
        error,
      });
    }
  }

  addModule(module: EventvisorModule) {
    if (this.modules.find((m) => m.name === module.name)) {
      this.options.reportDiagnostic({
        level: "error",
        code: "duplicate_module",
        message: `Module ${module.name} already registered`,
        details: {},
        moduleName: module.name,
      });

      return;
    }

    try {
      module.setup?.(this.getModuleApi(module.name));
    } catch (error) {
      this.clearDiagnosticSubscriptions(module.name);
      this.options.reportDiagnostic({
        level: "error",
        code: "module_setup_failed",
        message: `Module ${module.name} setup failed`,
        details: {},
        moduleName: module.name,
        error,
      });

      void this.closeModule(module);
      return;
    }

    this.modules.push(module);

    return async () => {
      if (this.modules.includes(module)) await this.removeModule(module.name);
    };
  }

  getModule(name: string) {
    return this.modules.find((module) => module.name === name);
  }

  async removeModule(name: string) {
    const module = this.getModule(name);

    if (!module) {
      this.logger.error(`Module ${name} not found`, { code: "module_not_found", moduleName: name });

      return;
    }

    this.modules = this.modules.filter((module) => module.name !== name);
    this.clearDiagnosticSubscriptions(name);
    await this.closeModule(module);
  }

  getModuleApi(moduleName: string): EventvisorModuleApi {
    return {
      getRevision: this.options.getRevision,
      onDiagnostic: (handler) => {
        const unsubscribe = this.options.onDiagnostic(handler);
        if (!this.diagnosticUnsubscribers[moduleName]) {
          this.diagnosticUnsubscribers[moduleName] = [];
        }
        this.diagnosticUnsubscribers[moduleName].push(unsubscribe);
        return unsubscribe;
      },
      reportDiagnostic: (diagnostic) =>
        this.options.reportDiagnostic({ ...diagnostic, moduleName }),
    };
  }

  async lookup(fullKey: string): Promise<Value> {
    const [moduleName, ...keyParts] = fullKey.split(".");
    const key = keyParts.join(".");

    const moduleInstance = this.getModule(moduleName);

    if (moduleInstance && moduleInstance.lookup) {
      try {
        return await moduleInstance.lookup({ key }, this.getModuleApi(moduleName));
      } catch (error) {
        this.logger.error(`Error in lookup`, { moduleName, key, error });

        return null;
      }
    }
    this.logger.error(`Module "${moduleName}" not found with "lookup" function`);

    return null;
  }

  async handle(
    fullKey: string,
    effectName: EffectName,
    effect: Effect,
    step: Step,
    payload: Value,
  ): Promise<void> {
    const [moduleName, key] = fullKey.split("."); // eslint-disable-line

    const moduleInstance = this.getModule(moduleName);

    if (moduleInstance && moduleInstance.handle) {
      try {
        return await moduleInstance.handle(
          { effectName, effect, step, payload },
          this.getModuleApi(moduleName),
        );
      } catch (error) {
        this.logger.error(`Error in handle`, { moduleName, effectName, error });
        throw error;
      }
    }

    this.logger.error(`Module "${moduleName}" not found with "handle" function`);
    throw new Error(`Module "${moduleName}" not found with "handle" function`);
  }

  transportExists(fullKey: string): boolean {
    const [moduleName, key] = fullKey.split("."); // eslint-disable-line

    const moduleInstance = this.getModule(moduleName);

    return !!(moduleInstance && moduleInstance.transport);
  }

  // @TODO: change multiple args to single options object
  async transport(
    fullKey: string,
    destinationName: DestinationName,
    eventName: EventName,
    payload: Value,
    eventLevel?: EventLevel,
    error?: Error,
  ): Promise<void> {
    const [moduleName, key] = fullKey.split("."); // eslint-disable-line

    const moduleInstance = this.getModule(moduleName);

    if (moduleInstance && moduleInstance.transport) {
      try {
        return await moduleInstance.transport(
          { destinationName, eventName, eventLevel, payload, error },
          this.getModuleApi(moduleName),
        );
      } catch (error) {
        this.logger.error(`Error in transport`, { moduleName, destinationName, eventName, error });

        return;
      }
    }

    this.logger.error(`Module "${moduleName}" not found with "transport" function`);
  }

  async readFromStorage(moduleName: ModuleName, key: string): Promise<Value> {
    const moduleInstance = this.getModule(moduleName);

    if (moduleInstance && moduleInstance.readFromStorage) {
      try {
        return await moduleInstance.readFromStorage({ key }, this.getModuleApi(moduleName));
      } catch (error) {
        this.logger.error(`Error in readFromStorage`, { moduleName, key, error });

        return null;
      }
    }

    this.logger.error(`Module "${moduleName}" not found with "readFromStorage" function`);

    return null;
  }

  async writeToStorage(moduleName: ModuleName, key: string, value: Value): Promise<void> {
    const moduleInstance = this.getModule(moduleName);

    if (moduleInstance && moduleInstance.writeToStorage) {
      try {
        return await moduleInstance.writeToStorage({ key, value }, this.getModuleApi(moduleName));
      } catch (error) {
        this.logger.error(`Error in writeToStorage`, { moduleName, key, value, error });

        return;
      }
    }

    this.logger.error(`Module "${moduleName}" not found with "writeToStorage" function`);

    return;
  }

  async removeFromStorage(moduleName: ModuleName, key: string): Promise<void> {
    const moduleInstance = this.getModule(moduleName);

    if (moduleInstance && moduleInstance.removeFromStorage) {
      try {
        return await moduleInstance.removeFromStorage({ key }, this.getModuleApi(moduleName));
      } catch (error) {
        this.logger.error(`Error in removeFromStorage`, { moduleName, key, error });

        return;
      }
    }

    this.logger.error(`Module "${moduleName}" not found with "removeFromStorage" function`);

    return;
  }

  async close() {
    for (const module of [...this.modules]) await this.removeModule(module.name);
  }
}
