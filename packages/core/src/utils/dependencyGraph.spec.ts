import { getEntityReferences } from "./dependencyGraph";

function entities() {
  return {
    attribute: { userId: {}, country: {} },
    event: { pageView: {}, checkout: {} },
    destination: {},
    effect: { welcome: {}, audit: {} },
    schema: {},
    target: {},
    test: {},
  } as any;
}

describe("dependency graph", () => {
  it("expands collection-wide sources", () => {
    expect(
      getEntityReferences(
        "event",
        {
          transforms: [
            { type: "set", target: "attributes", source: "attributes" },
            { type: "set", target: "effects", source: "effects" },
          ],
        },
        entities(),
      ),
    ).toEqual([
      { type: "attribute", key: "country" },
      { type: "attribute", key: "userId" },
      { type: "effect", key: "audit" },
      { type: "effect", key: "welcome" },
    ]);
  });

  it("expands broad effect triggers", () => {
    expect(
      getEntityReferences("effect", { on: ["event_tracked", "attribute_set"] }, entities()),
    ).toEqual([
      { type: "attribute", key: "country" },
      { type: "attribute", key: "userId" },
      { type: "event", key: "checkout" },
      { type: "event", key: "pageView" },
    ]);
  });
});
