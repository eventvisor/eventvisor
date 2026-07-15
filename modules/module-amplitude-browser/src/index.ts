import type { EventvisorModule } from "@eventvisor/sdk";

export type AmplitudeBrowserModuleOptions = {
  name?: string;
  amplitude: { track: (eventName: string, payload: unknown) => unknown };
};

export function createAmplitudeBrowserModule(
  options: AmplitudeBrowserModuleOptions,
): EventvisorModule {
  const { name = "amplitude-browser", amplitude } = options;

  return {
    name,

    transport: async ({ eventName, payload }) => {
      amplitude.track(eventName, payload);
    },
  };
}
