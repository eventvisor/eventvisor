import { getTransformPresentation } from "./transformModel";

describe("Catalog transform presentation", () => {
  it("describes literal whole-value replacement", () => {
    expect(getTransformPresentation({ type: "set", value: {} })).toMatchObject({
      operation: "Set value",
      summary: "Replace the entire value",
      input: { label: "Literal value", value: {} },
      output: { label: "Replace entire value" },
    });
  });

  it("describes sourced writes and conditions", () => {
    const conditions = [{ payload: "screen.width", operator: "notExists" }];
    expect(
      getTransformPresentation({
        lookup: "browser.screen.width",
        type: "set",
        target: "screen.width",
        conditions,
      }),
    ).toMatchObject({
      input: { label: "Lookup", value: "browser.screen.width" },
      output: { label: "Write to", value: "screen.width" },
      details: [],
      conditions,
    });
  });

  it("shows that a set literal takes precedence over a configured source", () => {
    expect(
      getTransformPresentation({
        lookup: "browser.screen.width",
        type: "set",
        target: "screen.width",
        value: 0,
      }),
    ).toMatchObject({
      input: { label: "Literal value", value: 0 },
      details: [],
      output: { label: "Write to", value: "screen.width" },
    });
  });

  it("shows fallback values only when the operation can use them as source input", () => {
    expect(
      getTransformPresentation({
        type: "append",
        lookup: "browser.language",
        target: "languages",
        value: "unknown",
      }).details,
    ).toEqual([{ label: "Fallback", value: "unknown" }]);
  });

  it("shows implicit current-target reads and operation details", () => {
    expect(getTransformPresentation({ type: "trim", target: "firstName" })).toMatchObject({
      input: { label: "Current value at", value: "firstName" },
      operation: "Trim whitespace",
      summary: "Trim whitespace at “firstName”",
      output: { label: "Write to", value: "firstName" },
    });
    expect(
      getTransformPresentation({
        type: "concat",
        payload: ["firstName", "lastName"],
        separator: " ",
        target: "fullName",
      }),
    ).toMatchObject({
      input: { label: "Payload", value: ["firstName", "lastName"] },
      details: [{ label: "Separator", value: " " }],
      output: { label: "Write to", value: "fullName" },
    });
  });

  it("preserves ordered rename mappings", () => {
    expect(
      getTransformPresentation({
        type: "rename",
        targetMap: [{ old: "new" }, { "profile.name": "customer.name" }],
      }),
    ).toMatchObject({
      summary: "Rename 2 paths",
      mappings: [
        { from: "old", to: "new" },
        { from: "profile.name", to: "customer.name" },
      ],
    });
  });

  it("shows default mathematical amounts", () => {
    expect(getTransformPresentation({ type: "increment", target: "count" }).details).toEqual([
      { label: "Amount", value: 1 },
    ]);
    expect(getTransformPresentation({ type: "decrement", value: 3 }).details).toEqual([
      { label: "Amount", value: 3 },
    ]);
  });

  it("describes root and targeted collection operations", () => {
    expect(getTransformPresentation({ type: "spread", value: { active: true } })).toMatchObject({
      input: { label: "Literal value", value: { active: true } },
      output: { label: "Updated entire value" },
    });
    expect(
      getTransformPresentation({ type: "append", attribute: "customerId", target: "owners" }),
    ).toMatchObject({
      input: { label: "Attribute", value: "customerId" },
      output: { label: "Write to", value: "owners" },
    });
  });
});
