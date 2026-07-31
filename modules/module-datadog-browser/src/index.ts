import type { EventvisorModule } from "@eventvisor/sdk";

export type DatadogBrowserModuleOptions = {
  name?: string;
  datadogRum: {
    addAction: (eventName: string, payload: unknown) => unknown;
    addError: (error: Error, payload: unknown) => unknown;
  };
};

export function createDatadogBrowserModule(options: DatadogBrowserModuleOptions): EventvisorModule {
  const { name = "datadog-browser", datadogRum } = options;

  return {
    name,

    transport: async ({ eventName, payload, error }) => {
      if (error) {
        await Promise.resolve(datadogRum.addError(error, payload));
      } else {
        await Promise.resolve(datadogRum.addAction(eventName, payload));
      }
    },
  };
}
