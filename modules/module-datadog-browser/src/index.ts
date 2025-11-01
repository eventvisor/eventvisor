import type { Module } from "@eventvisor/sdk";

export type DatadogBrowserModuleOptions = {
  name?: string;
  datadogRum: any; // @TODO: type this later
};

export function createDatadogBrowserModule(options: DatadogBrowserModuleOptions): Module {
  const { name = "datadog-browser", datadogRum } = options;

  return {
    name,

    transport: async ({ eventName, payload, error }) => {
      if (error) {
        datadogRum.addError(error, payload);
      } else {
        datadogRum.addAction(eventName, payload);
      }
    },
  };
}
