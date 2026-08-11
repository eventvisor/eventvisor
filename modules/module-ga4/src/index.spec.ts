import { createGA4Module } from "./index.js";

describe("createGA4Module", () => {
  it("normalizes event names before sending them to gtag", async () => {
    const gtag = jest.fn();
    (globalThis as any).gtag = gtag;
    await createGA4Module().transport!(
      { destinationName: "ga4", eventName: "Checkout Started", revision: "1", payload: { id: 1 } },
      {} as any,
    );
    expect(gtag).toHaveBeenCalledWith("event", "checkout_started", { id: 1 });
    delete (globalThis as any).gtag;
  });

  it.each([
    ["checkoutStarted", "checkout_started"],
    ["URLLoaded", "url_loaded"],
    [" checkout---started ", "checkout_started"],
  ])("normalizes %s as %s", async (input, expected) => {
    const gtag = jest.fn();
    await createGA4Module({ gtag }).transport!(
      { destinationName: "ga4", eventName: input, revision: "1", payload: {} },
      {} as any,
    );
    expect(gtag).toHaveBeenCalledWith("event", expected, {});
  });
});
