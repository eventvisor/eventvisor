import { Module } from "@eventvisor/sdk";

export type GA4ModuleOptions = {
  name?: string;
};

function underscore(str: string): string {
  return str
    .replace(/([A-Z])/g, "_$1")
    .replace(/[^a-zA-Z0-9_]/g, "")
    .replace(/\s+/g, "_")
    .toLowerCase();
}

export function createGA4Module(options: GA4ModuleOptions = {}): Module {
  const { name = "ga4" } = options;

  return {
    name,

    transport: async ({ eventName, payload }) => {
      // @ts-expect-error gtag is loaded from GA4 script
      gtag("event", underscore(eventName), payload);
    },
  };
}
