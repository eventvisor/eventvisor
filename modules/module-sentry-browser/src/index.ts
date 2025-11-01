import type { Module } from "@eventvisor/sdk";

export type SentryBrowserModuleOptions = {
  name?: string;
  Sentry: any; // @TODO: type this later
};

export function createSentryBrowserModule(options: SentryBrowserModuleOptions): Module {
  const { name = "sentry-browser", Sentry } = options;

  return {
    name,

    transport: async ({ eventName, eventLevel, payload, error }) => {
      if (error) {
        Sentry.captureException(error, {
          level: eventLevel,
          extra: payload,
        });
      } else {
        Sentry.captureMessage(eventName, {
          level: eventLevel,
          extra: payload,
        });
      }
    },
  };
}
