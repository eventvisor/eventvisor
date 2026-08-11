import {
  decodeRouteSegment,
  encodeDataPath,
  encodeRouteSegment,
  getEntityRoute,
  sortSetKeys,
} from "./entityTypes";

describe("Catalog entity paths", () => {
  it("keeps slash namespaced keys in one browser route segment", () => {
    const encoded = encodeRouteSegment("checkout/order.submitted");
    expect(encoded).toBe("checkout%252Forder.submitted");
    expect(decodeRouteSegment(encoded)).toBe("checkout%2Forder.submitted");
    expect(decodeRouteSegment(decodeRouteSegment(encoded))).toBe("checkout/order.submitted");
    expect(getEntityRoute("event", "checkout/order.submitted")).toBe(
      "/events/checkout%252Forder.submitted",
    );
  });

  it("uses path segments for matching generated entity files", () => {
    expect(encodeDataPath("checkout/order submitted")).toBe("checkout/order%20submitted");
  });

  it("orders development first and production last", () => {
    expect(sortSetKeys(["production", "staging", "development", "preview"])).toEqual([
      "development",
      "preview",
      "staging",
      "production",
    ]);
  });
});
