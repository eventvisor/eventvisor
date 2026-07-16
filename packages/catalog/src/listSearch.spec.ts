import type { EntitySummary } from "./types";
import { matchesQuery, parseQuery } from "./listSearch";

const event: EntitySummary = {
  key: "checkout/order_submitted",
  description: "Checkout completed",
  tags: ["web"],
  targets: ["storefront"],
  schemaType: "object",
  archived: false,
};

describe("Catalog list search", () => {
  it("parses quoted terms and Featurevisor-style qualifiers", () => {
    expect(parseQuery('"checkout completed" tag:web target:storefront')).toEqual({
      terms: ["checkout completed"],
      qualifiers: [
        { key: "tag", value: "web" },
        { key: "target", value: "storefront" },
      ],
    });
  });

  it("matches namespaced keys, metadata and boolean qualifiers", () => {
    expect(matchesQuery(event, "order_submitted tag:web target:storefront archived:false")).toBe(
      true,
    );
    expect(matchesQuery(event, "tag:mobile")).toBe(false);
    expect(matchesQuery(event, "archived:true")).toBe(false);
  });

  it("matches tag and target qualifiers exactly", () => {
    expect(matchesQuery(event, "tag:we")).toBe(false);
    expect(matchesQuery(event, "target:store")).toBe(false);
  });

  it("rejects unknown qualifiers instead of silently ignoring them", () => {
    expect(matchesQuery(event, "unknown:anything")).toBe(false);
  });
});
