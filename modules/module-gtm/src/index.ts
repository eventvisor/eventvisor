import type { EventvisorModule } from "@eventvisor/sdk";

export type GTMModuleOptions = {
  name?: string;
  dataLayer?: Array<Record<string, any>>;
};

export function createGTMModule(options: GTMModuleOptions = {}): EventvisorModule {
  const { name = "gtm", dataLayer } = options;

  return {
    name,

    transport: async ({ eventName, payload }) => {
      const target =
        dataLayer || (typeof window === "undefined" ? undefined : (window as any).dataLayer);
      if (!target) throw new Error("GTM module requires a dataLayer.");
      target.push({
        ...(payload as Record<string, any>),
        event: eventName,
      });
    },
  };
}
