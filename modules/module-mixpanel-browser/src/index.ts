import type { EventvisorModule } from "@eventvisor/sdk";

export type MixpanelBrowserModuleOptions = {
  name?: string;
  mixpanel: { track: (eventName: string, payload: unknown) => unknown };
};

export function createMixpanelBrowserModule(
  options: MixpanelBrowserModuleOptions,
): EventvisorModule {
  const { name = "mixpanel-browser", mixpanel } = options;

  return {
    name,

    transport: async ({ eventName, payload }) => {
      await Promise.resolve(mixpanel.track(eventName, payload));
    },
  };
}
