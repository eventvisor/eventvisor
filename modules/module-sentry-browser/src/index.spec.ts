import { createSentryBrowserModule } from "./index.js";

describe("createSentryBrowserModule", () => {
  it("captures messages and exceptions with event metadata", async () => {
    const Sentry = { captureMessage: jest.fn(), captureException: jest.fn() };
    const transport = createSentryBrowserModule({ Sentry }).transport!;
    await transport(
      {
        destinationName: "sentry",
        eventName: "viewed",
        revision: "1",
        eventLevel: "info",
        payload: { id: 1 },
      },
      {} as any,
    );
    const error = new Error("failed");
    await transport(
      {
        destinationName: "sentry",
        eventName: "failed",
        revision: "1",
        eventLevel: "error",
        payload: {},
        error,
      },
      {} as any,
    );
    expect(Sentry.captureMessage).toHaveBeenCalledWith("viewed", {
      level: "info",
      extra: { id: 1 },
    });
    expect(Sentry.captureException).toHaveBeenCalledWith(error, { level: "error", extra: {} });
  });
});
