import { createGTMModule } from "./index.js";

describe("createGTMModule", () => {
  it("pushes the payload and Eventvisor event name", async () => {
    const dataLayer: Record<string, any>[] = [];
    await createGTMModule({ dataLayer }).transport!(
      { destinationName: "gtm", eventName: "checkout", revision: "1", payload: { id: 1 } },
      {} as any,
    );
    expect(dataLayer).toEqual([{ id: 1, event: "checkout" }]);
  });
});
