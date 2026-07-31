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
  const { name = "newrelic-browser", nr } = options;

  return {
    name,

    transport: async ({ eventName, payload, error }) => {
      const client = nr || (typeof window === "undefined" ? undefined : (window as any).newrelic);
      if (!client) throw new Error("New Relic browser module requires a New Relic client.");
      if (error) {
        await Promise.resolve(client.noticeError(error, payload));
      } else {
        await Promise.resolve(client.addPageAction(eventName, payload));
      }
    },
  };
}
