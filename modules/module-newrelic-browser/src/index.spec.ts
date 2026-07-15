import { createNewrelicBrowserModule } from "./index";

describe("createNewRelicBrowserModule", () => {
  it("routes events and errors to the matching New Relic API", async () => {
    const nr = { addPageAction: jest.fn(), noticeError: jest.fn() };
    const transport = createNewrelicBrowserModule({ nr }).transport!;
    await transport(
      { destinationName: "newrelic", eventName: "viewed", payload: { id: 1 } },
      {} as any,
    );
    const error = new Error("failed");
    await transport(
      { destinationName: "newrelic", eventName: "failed", payload: {}, error },
      {} as any,
    );
    expect(nr.addPageAction).toHaveBeenCalledWith("viewed", { id: 1 });
    expect(nr.noticeError).toHaveBeenCalledWith(error, {});
  });
});
