import type { Module } from "@eventvisor/sdk";

export type MixpanelBrowserModuleOptions = {
  name?: string;
  mixpanel: any; // @TODO: type this later
};

export function createMixpanelBrowserModule(options: MixpanelBrowserModuleOptions): Module {
  const { name = "mixpanel-browser", mixpanel } = options;

  return {
    name,

    transport: async ({ eventName, payload }) => {
      mixpanel.track(eventName, payload);
    },
  };
}
