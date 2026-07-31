import type { EventvisorModule } from "@eventvisor/sdk";

export type SegmentBrowserModuleOptions = {
  name?: string;
  analytics: { track: (eventName: string, payload: unknown) => unknown };
};

export function createSegmentBrowserModule(options: SegmentBrowserModuleOptions): EventvisorModule {
  const { name = "segment-browser", analytics } = options;

  return {
    name,

    transport: async ({ eventName, payload }) => {
      await Promise.resolve(analytics.track(eventName, payload));
    },
  };
}
