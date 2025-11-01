import type { Module } from "@eventvisor/sdk";

export type DatadogBrowserModuleOptions = {
  name?: string;
  rum: any; // @TODO: type this later
};

export function createDatadogBrowserModule(options: DatadogBrowserModuleOptions): Module {
  const { name = "datadog-browser", rum } = options;

  return {
    name,

    transport: async ({ eventName, payload, error }) => {
      if (error) {
        rum.addError(error, payload);
      } else {
        rum.addAction(eventName, payload);
      }
    },
  };
}
