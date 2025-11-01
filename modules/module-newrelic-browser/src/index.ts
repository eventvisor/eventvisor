import type { Module } from "@eventvisor/sdk";

export type NewRelicBrowserModuleOptions = {
  name?: string;
  nr?: any; // @TODO: type this later
};

export function createNewRelicBrowserModule(options: NewRelicBrowserModuleOptions = {}): Module {
  const { name = "newrelic-browser", nr = (window as any).newrelic } = options;

  return {
    name,

    transport: async ({ eventName, payload, error }) => {
      if (error) {
        nr.noticeError(error, payload);
      } else {
        nr.addPageAction(eventName, payload);
      }
    },
  };
}
