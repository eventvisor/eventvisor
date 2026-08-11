import { createDatadogBrowserModule } from "./index.js";

describe("createDatadogBrowserModule", () => {
  it("routes events and errors to the matching Datadog API", async () => {
    const datadogRum = { addAction: jest.fn(), addError: jest.fn() };
    const transport = createDatadogBrowserModule({ datadogRum }).transport!;
    await transport(
      { destinationName: "datadog", eventName: "viewed", revision: "1", payload: { id: 1 } },
      {} as any,
    );
    const error = new Error("failed");
    await transport(
      { destinationName: "datadog", eventName: "failed", revision: "1", payload: {}, error },
      {} as any,
    );
    expect(datadogRum.addAction).toHaveBeenCalledWith("viewed", { id: 1 });
    expect(datadogRum.addError).toHaveBeenCalledWith(error, {});
  });
});
