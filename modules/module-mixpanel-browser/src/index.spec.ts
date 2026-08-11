import { createMixpanelBrowserModule } from "./index.js";

describe("createMixpanelBrowserModule", () => {
  it("tracks the event and payload", async () => {
    const mixpanel = { track: jest.fn() };
    await createMixpanelBrowserModule({ mixpanel }).transport!(
      { destinationName: "mixpanel", eventName: "viewed", revision: "1", payload: { id: 1 } },
      {} as any,
    );
    expect(mixpanel.track).toHaveBeenCalledWith("viewed", { id: 1 });
  });
});
