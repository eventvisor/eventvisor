import type { Module } from "@eventvisor/sdk";

export type AmplitudeBrowserModuleOptions = {
  name?: string;
  amplitude: any; // @TODO: type this later
};

export function createAmplitudeBrowserModule(options: AmplitudeBrowserModuleOptions): Module {
  const { name = "amplitude-browser", amplitude } = options;

  return {
    name,

    transport: async ({ eventName, payload }) => {
      amplitude.track(eventName, payload);
    },
  };
}
