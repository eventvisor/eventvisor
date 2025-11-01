import type { Module } from "@eventvisor/sdk";

export type LocalStorageModuleOptions = {
  name?: string;
  prefix?: string;
};

export function createLocalStorageModule(options: LocalStorageModuleOptions = {}): Module {
  const { prefix = "_eventvisor_", name = "localstorage" } = options;

  return {
    name,

    // this is different than storage use cases,
    // and prefix is not meant to be used here
    lookup: async ({ key }) => {
      return window.localStorage.getItem(key);
    },

    readFromStorage: async ({ key }) => {
      const fullKey = `${prefix}${key}`;

      const value = window.localStorage.getItem(fullKey);

      if (!value) {
        return null;
      }

      try {
        const parsedValue = JSON.parse(value);

        if (parsedValue && typeof parsedValue.data !== "undefined") {
          return parsedValue.data;
        }
        // eslint-disable-next-line
      } catch (e) {
        return null;
      }

      return null;
    },

    writeToStorage: async ({ key, value }) => {
      const fullKey = `${prefix}${key}`;

      const stringifiedValue = JSON.stringify({
        data: value,
      });

      window.localStorage.setItem(fullKey, stringifiedValue);
    },

    removeFromStorage: async ({ key }) => {
      const fullKey = `${prefix}${key}`;

      window.localStorage.removeItem(fullKey);
    },
  };
}
