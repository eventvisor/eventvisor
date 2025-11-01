import type { Module } from "@eventvisor/sdk";

export type SegmentBrowserModuleOptions = {
  name?: string;
  analytics: any; // @TODO: type this later
};

export function createSegmentBrowserModule(options: SegmentBrowserModuleOptions): Module {
  const { name = "segment-browser", analytics } = options;

  return {
    name,

    transport: async ({ eventName, payload }) => {
      analytics.track(eventName, payload);
    },
  };
}
