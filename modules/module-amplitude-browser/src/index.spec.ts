import { createAmplitudeBrowserModule } from "./index";

describe("createAmplitudeBrowserModule", () => {
  it("tracks the event and payload", async () => {
    const amplitude = { track: jest.fn() };
    await createAmplitudeBrowserModule({ amplitude }).transport!(
      { destinationName: "amplitude", eventName: "viewed", payload: { id: 1 } },
      {} as any,
    );
    expect(amplitude.track).toHaveBeenCalledWith("viewed", { id: 1 });
  });
});
