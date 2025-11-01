import type { Module } from "@eventvisor/sdk";

export type ConsoleModuleOptions = {
  name?: string;
  console?: Console;
  prefix?: string;
};

export function createConsoleModule(options: ConsoleModuleOptions = {}): Module {
  const { name = "console", prefix = "[Eventvisor] ", console = globalThis.console } = options;

  return {
    name,

    transport: async ({ eventName, eventLevel, payload, error }) => {
      const message = `${prefix}[${eventName}]`;

      if (error) {
        console.error(message, error, payload);

        return;
      }

      if (eventLevel === "error") {
        console.error(message, payload);
      } else if (eventLevel === "warning") {
        console.warn(message, payload);
      } else if (eventLevel === "info") {
        console.info(message, payload);
      } else if (eventLevel === "debug") {
        console.debug(message, payload);
      } else {
        console.log(message, payload);
      }
    },
  };
}
