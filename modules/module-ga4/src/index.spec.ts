import { createGA4Module } from "./index";

describe("createGA4Module", () => {
  it("normalizes event names before sending them to gtag", async () => {
    const gtag = jest.fn();
    (globalThis as any).gtag = gtag;
    await createGA4Module().transport!(
      { destinationName: "ga4", eventName: "Checkout Started", payload: { id: 1 } },
      {} as any,
    );
    expect(gtag).toHaveBeenCalledWith("event", "_checkout_started", { id: 1 });
    delete (globalThis as any).gtag;
  });
});
