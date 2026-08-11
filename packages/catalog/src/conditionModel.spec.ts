import { getConditionPresentation } from "./conditionModel";

describe("Catalog condition presentation", () => {
  it("turns a plain condition into readable parts", () => {
    expect(
      getConditionPresentation({
        payload: "metrics.total",
        operator: "greaterThanOrEquals",
        value: 100,
      }),
    ).toEqual({
      kind: "leaf",
      source: { label: "Payload", value: "metrics.total" },
      operator: "greaterThanOrEquals",
      operatorLabel: "is at least",
      value: 100,
    });
  });

  it("describes implicit arrays and nested groups accurately", () => {
    expect(
      getConditionPresentation([
        { payload: "channel", operator: "equals", value: "checkout" },
        {
          or: [
            { attribute: "country", operator: "equals", value: "nl" },
            { attribute: "country", operator: "equals", value: "de" },
          ],
        },
      ]),
    ).toMatchObject({
      kind: "group",
      mode: "all",
      label: "All",
      children: [
        { kind: "leaf", source: { label: "Payload", value: "channel" } },
        { kind: "group", mode: "any", label: "Any" },
      ],
    });
  });

  it("explains not using Eventvisor's implicit AND semantics", () => {
    expect(
      getConditionPresentation({
        not: [
          { payload: "plan", operator: "equals", value: "free" },
          { payload: "trial", operator: "equals", value: true },
        ],
      }),
    ).toMatchObject({
      kind: "group",
      mode: "notAll",
      label: "Not all",
      description: "The complete group below must not match",
    });
  });

  it("parses stringified conditions without exposing their serialization", () => {
    expect(
      getConditionPresentation(
        JSON.stringify({ lookup: "request.id", operator: "exists", regexFlags: undefined }),
      ),
    ).toEqual({
      kind: "leaf",
      source: { label: "Lookup", value: "request.id" },
      operator: "exists",
      operatorLabel: "exists",
    });
  });

  it("handles wildcard and malformed conditions safely", () => {
    expect(getConditionPresentation("*")).toEqual({ kind: "always", label: "Always" });
    expect(getConditionPresentation("not json")).toEqual({
      kind: "unknown",
      label: "Condition could not be displayed",
    });
  });
});
