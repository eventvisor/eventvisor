import type { DatafileContent, WithLookups, Value, Step } from "@eventvisor/types";

import { Eventvisor, LogLevel, getComplexPersists } from "@eventvisor/sdk";
import type { Module } from "@eventvisor/sdk";

import type { TestProjectOptions } from "./testProject";

export interface CreateTestInstanceResult {
  e: Eventvisor;
  getBodiesByDestination: () => Record<string, Value[]>;
  getBodiesBySingleDestination: (destinationName: string) => Value[] | undefined;
  getCalledStepsByEffect: () => Record<string, Step[]>;
  getCalledStepsBySingleEffect: (effectName: string) => Step[] | undefined;
}

export interface CreateTestInstanceOptions {
  datafile: DatafileContent;
  cliOptions: TestProjectOptions;
  withLookups?: WithLookups;
}

export function createTestInstance(options: CreateTestInstanceOptions): CreateTestInstanceResult {
  const { datafile, cliOptions, withLookups } = options;

  /**
   * Log level
   */
  let logLevel: LogLevel = "error";

  if (cliOptions.verbose) {
    logLevel = "debug";
  } else if (cliOptions.quiet) {
    logLevel = "fatal";
  }

  /**
   * Transport names
   */
  const transportNames = new Set<string>();
  const destinationNames = Object.keys(datafile.destinations);
  for (const destinationName of destinationNames) {
    const destination = datafile.destinations[destinationName];
    if (destination.transport) {
      transportNames.add(destination.transport);
    }
  }

  /**
   * Storage names
   */
  const storageNames = new Set<string>();

  const attributes = Object.keys(datafile.attributes);
  for (const attributeName of attributes) {
    const attribute = datafile.attributes[attributeName];
    if (attribute.persist) {
      const persists = getComplexPersists(attribute.persist);

      for (const persist of persists) {
        storageNames.add(persist.storage);
      }
    }
  }

  /**
   * Handler names
   */
  const handlerNames = new Set<string>();

  const effects = Object.keys(datafile.effects);
  for (const effectName of effects) {
    const effect = datafile.effects[effectName];

    // handler
    if (effect.steps) {
      for (const step of effect.steps) {
        if (step.handler) {
          handlerNames.add(step.handler);
        }
      }
    }

    // storage
    if (effect.persist) {
      const persists = getComplexPersists(effect.persist);

      for (const persist of persists) {
        storageNames.add(persist.storage);
      }
    }
  }

  /**
   * Modules
   */
  const modules: Module[] = [];
  const bodiesByDestination: Record<string, any[]> = {};
  const calledStepsByEffect: Record<string, Step[]> = {};

  const lookupsMap = {};
  for (const [key, value] of Object.entries(withLookups || {})) {
    const [moduleName, ...keyParts] = key.split(".");
    const lookupKey = keyParts.join(".");
    if (typeof lookupsMap[moduleName] === "undefined") {
      lookupsMap[moduleName] = {};
    }
    lookupsMap[moduleName][lookupKey] = value;
  }

  const allModuleNames = Array.from(handlerNames)
    .concat(Array.from(transportNames))
    .concat(Object.keys(lookupsMap))
    .concat(Array.from(storageNames));

  for (const moduleName of allModuleNames) {
    const moduleObj: Module = { name: moduleName };

    // transport
    if (transportNames.has(moduleName)) {
      moduleObj.transport = (options) => {
        const { destinationName, payload } = options;

        if (typeof bodiesByDestination[destinationName] === "undefined") {
          bodiesByDestination[destinationName] = [];
        }

        bodiesByDestination[destinationName].push(payload);

        return Promise.resolve();
      };
    }

    // storage
    if (storageNames.has(moduleName)) {
      const storageData = {};

      moduleObj.readFromStorage = (options) => {
        const { key } = options;

        return Promise.resolve(storageData[key]);
      };

      moduleObj.writeToStorage = (options) => {
        const { key, value } = options;

        storageData[key] = value;

        return Promise.resolve();
      };
    }

    // handler
    if (handlerNames.has(moduleName)) {
      moduleObj.handle = (options) => {
        const { effectName, step } = options;

        if (typeof calledStepsByEffect[effectName] === "undefined") {
          calledStepsByEffect[effectName] = [];
        }

        calledStepsByEffect[effectName].push(step);

        return Promise.resolve();
      };
    }

    // lookup
    Object.keys(lookupsMap).forEach((moduleName) => {
      if (moduleName === moduleObj.name) {
        moduleObj.lookup = (options) => {
          const { key } = options;

          return Promise.resolve(lookupsMap[moduleName][key]);
        };
      }
    });

    modules.push(moduleObj);
  }

  /**
   * Instance
   */
  const e = new Eventvisor({
    datafile,
    logLevel,
    modules,
  });

  return {
    e,

    // destinations
    getBodiesByDestination: () => {
      return bodiesByDestination;
    },
    getBodiesBySingleDestination: (destinationName: string) => {
      return bodiesByDestination[destinationName];
    },

    // effects
    getCalledStepsByEffect: () => {
      return calledStepsByEffect;
    },
    getCalledStepsBySingleEffect: (effectName: string) => {
      return calledStepsByEffect[effectName];
    },
  };
}
