import type { EventvisorModule } from "@eventvisor/sdk";

export type NewrelicBrowserModuleOptions = {
  name?: string;
  nr?: {
    addPageAction: (eventName: string, payload: unknown) => unknown;
    noticeError: (error: Error, payload: unknown) => unknown;
  };
};

export function createNewrelicBrowserModule(
  options: NewrelicBrowserModuleOptions = {},
): EventvisorModule {
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
