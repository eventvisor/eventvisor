import { createSegmentBrowserModule } from "./index";

describe("createSegmentBrowserModule", () => {
  it("tracks the event and payload", async () => {
    const analytics = { track: jest.fn() };
    await createSegmentBrowserModule({ analytics }).transport!(
      { destinationName: "segment", eventName: "viewed", payload: { id: 1 } },
      {} as any,
    );
    expect(analytics.track).toHaveBeenCalledWith("viewed", { id: 1 });
  });
});
