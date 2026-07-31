import type { EventvisorModule } from "@eventvisor/sdk";

export type SentryBrowserModuleOptions = {
  name?: string;
  Sentry: {
    captureException: (error: Error, context: Record<string, unknown>) => unknown;
    captureMessage: (message: string, context: Record<string, unknown>) => unknown;
  };
};

export function createSentryBrowserModule(options: SentryBrowserModuleOptions): EventvisorModule {
  const { name = "sentry-browser", Sentry } = options;

  return {
    name,

    transport: async ({ eventName, eventLevel, payload, error }) => {
      if (error) {
        await Promise.resolve(
          Sentry.captureException(error, {
            level: eventLevel,
            extra: payload,
          }),
        );
      } else {
        await Promise.resolve(
          Sentry.captureMessage(eventName, {
            level: eventLevel,
            extra: payload,
          }),
        );
      }
    },
  };
}
