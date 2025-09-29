import { Module } from "@eventvisor/sdk";

export type GTMModuleOptions = {
  name?: string;
  dataLayer?: Array<Record<string, any>>;
};

export function createGTMModule(options: GTMModuleOptions = {}): Module {
  const { name = "gtm", dataLayer = (window as any).dataLayer } = options;

  return {
    name,

    transport: async ({ eventName, payload }) => {
      dataLayer.push({
        ...(payload as Record<string, any>),
        event: eventName,
      });
    },
  };
}
