import { createMixpanelBrowserModule } from "./index";

describe("createMixpanelBrowserModule", () => {
  it("tracks the event and payload", async () => {
    const mixpanel = { track: jest.fn() };
    await createMixpanelBrowserModule({ mixpanel }).transport!(
      { destinationName: "mixpanel", eventName: "viewed", payload: { id: 1 } },
      {} as any,
    );
    expect(mixpanel.track).toHaveBeenCalledWith("viewed", { id: 1 });
  });
});
