import type {
  Value,
  Effect,
  Step,
  EventName,
  DestinationName,
  EffectName,
  EventLevel,
} from "@eventvisor/types";

import type { Logger } from "./logger";
import type { DatafileReader } from "./datafileReader";
import type { SourceResolver } from "./sourceResolver";

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
  payload: Value; // @TODO: rename to body?
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

export interface ModuleDependencies {
  datafileReader: DatafileReader;
  logger: Logger;
  sourceResolver: SourceResolver; // @TODO: single resolveSource function?
}

export interface Module {
  name: ModuleName;

  // initialize?

  lookup?: (options: LookupOptions, deps: ModuleDependencies) => Promise<Value>;

  // transform?: (options: TransformOptions, deps: ModuleDependencies) => Promise<Value>;

  handle?: (options: HandleOptions, deps: ModuleDependencies) => Promise<void>;

  transport?: (options: TransportOptions, deps: ModuleDependencies) => Promise<void>;

  readFromStorage?: (options: ReadFromStorageOptions, deps: ModuleDependencies) => Promise<Value>;
  writeToStorage?: (options: WriteToStorageOptions, deps: ModuleDependencies) => Promise<void>;
  removeFromStorage?: (
    options: RemoveFromStorageOptions,
    deps: ModuleDependencies,
  ) => Promise<void>;
}

export interface ModulesManagerOptions {
  logger: Logger;
  getDatafileReader: () => DatafileReader;
  getSourceResolver: () => SourceResolver;
}

export class ModulesManager {
  private logger: Logger;
  private getDatafileReader: () => DatafileReader;
  private getSourceResolver: () => SourceResolver;

  // @TODO: can be optimized further by keeping only array of names, but keeping actual modules in an object
  private modules: Module[];

  constructor(options: ModulesManagerOptions) {
    const { logger, getDatafileReader, getSourceResolver } = options;

    this.logger = logger;
    this.getDatafileReader = getDatafileReader;
    this.getSourceResolver = getSourceResolver;
    this.modules = [];
  }

  registerModule(module: Module) {
    if (this.modules.find((m) => m.name === module.name)) {
      this.logger.error(`Module ${module.name} already registered`);

      return;
    }

    this.modules.push(module);
  }

  getModule(name: string) {
    return this.modules.find((module) => module.name === name);
  }

  removeModule(name: string) {
    const module = this.getModule(name);

    if (!module) {
      this.logger.error(`Module ${name} not found`);

      return;
    }

    this.modules = this.modules.filter((module) => module.name !== name);
  }

  getModuleDependencies(): ModuleDependencies {
    return {
      datafileReader: this.getDatafileReader(),
      logger: this.logger,
      sourceResolver: this.getSourceResolver(),
    };
  }

  async lookup(fullKey: string): Promise<Value> {
    const [moduleName, ...keyParts] = fullKey.split(".");
    const key = keyParts.join(".");

    const moduleInstance = this.getModule(moduleName);

    if (moduleInstance && moduleInstance.lookup) {
      try {
        return await moduleInstance.lookup({ key }, this.getModuleDependencies());
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
          this.getModuleDependencies(),
        );
      } catch (error) {
        this.logger.error(`Error in handle`, { moduleName, effectName, error });

        return;
      }
    }

    this.logger.error(`Module "${moduleName}" not found with "handle" function`);

    return;
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
          this.getModuleDependencies(),
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
        return await moduleInstance.readFromStorage({ key }, this.getModuleDependencies());
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
        return await moduleInstance.writeToStorage({ key, value }, this.getModuleDependencies());
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
        return await moduleInstance.removeFromStorage({ key }, this.getModuleDependencies());
      } catch (error) {
        this.logger.error(`Error in removeFromStorage`, { moduleName, key, error });

        return;
      }
    }

    this.logger.error(`Module "${moduleName}" not found with "removeFromStorage" function`);

    return;
  }
}
