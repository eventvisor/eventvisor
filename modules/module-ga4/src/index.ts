import type { EventvisorModule } from "@eventvisor/sdk";

export type GA4ModuleOptions = {
  name?: string;
  gtag?: (...args: unknown[]) => unknown;
};

function underscore(str: string): string {
  return str
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1_$2")
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
}

export function createGA4Module(options: GA4ModuleOptions = {}): EventvisorModule {
  const { name = "ga4", gtag: configuredGtag } = options;

  return {
    name,

    transport: async ({ eventName, payload }) => {
      const target = configuredGtag || (globalThis as any).gtag;
      if (!target) throw new Error("GA4 module requires a gtag function.");
      await Promise.resolve(target("event", underscore(eventName), payload));
    },
  };
}
