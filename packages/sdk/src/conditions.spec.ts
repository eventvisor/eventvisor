import type { Condition, Conditions, DatafileContent, Value } from "@eventvisor/types";
import { createEventvisor } from "./index.js";

function instance(condition: Conditions) {
  const datafile: DatafileContent = {
    schemaVersion: "1",
    revision: "1",
    attributes: {},
    destinations: {},
    effects: {},
    events: { test: { skipValidation: true, conditions: condition } },
  };
  return createEventvisor({ datafile, logLevel: "fatal" });
}

async function matches(condition: Conditions, value: Value) {
  const e = instance(condition);
  try {
    return (await e.track("test", value)) !== null;
  } finally {
    await e.close();
  }
}

describe("conditions", () => {
  test.each([
    ["equals", "same", "same", true],
    ["notEquals", "same", "other", true],
    ["greaterThan", 5, 4, true],
    ["greaterThanOrEquals", 5, 5, true],
    ["lessThan", 5, 6, true],
    ["lessThanOrEquals", 5, 5, true],
    ["contains", "hello world", "world", true],
    ["notContains", "hello", "world", true],
    ["startsWith", "hello", "he", true],
    ["endsWith", "hello", "lo", true],
    ["semverEquals", "1.2.3", "1.2.3", true],
    ["semverNotEquals", "1.2.3", "1.2.4", true],
    ["semverGreaterThan", "2.0.0", "1.9.9", true],
    ["semverGreaterThanOrEquals", "2.0.0", "2.0.0", true],
    ["semverLessThan", "1.0.0", "2.0.0", true],
    ["semverLessThanOrEquals", "1.0.0", "1.0.0", true],
    ["before", "2025-01-01", "2026-01-01", true],
    ["after", "2026-01-01", "2025-01-01", true],
    ["includes", ["one", "two"], "two", true],
    ["notIncludes", ["one"], "two", true],
    ["matches", "HELLO", "^hello$", true],
    ["notMatches", "hello", "world", true],
    ["in", "one", ["one", "two"], true],
    ["notIn", "three", ["one", "two"], true],
  ])("evaluates %s", async (operator, source, expected, result) => {
    await expect(
      matches(
        {
          payload: "value",
          operator: operator as any,
          value: expected,
          ...(operator === "matches" ? { regexFlags: "i" } : {}),
        },
        { value: source } as any,
      ),
    ).resolves.toBe(result);
  });

  it("handles existence independently of source value type", async () => {
    await expect(matches({ payload: "value", operator: "exists" }, { value: 0 })).resolves.toBe(
      true,
    );
    await expect(matches({ payload: "value", operator: "notExists" }, {})).resolves.toBe(true);
    await expect(matches({ payload: "value", operator: "exists" }, { value: null })).resolves.toBe(
      false,
    );
  });

  it("uses implicit AND for arrays and not children", async () => {
    const yes = { payload: "yes", operator: "equals", value: true } as Condition;
    const no = { payload: "no", operator: "equals", value: true } as Condition;
    await expect(matches([yes, no], { yes: true, no: false })).resolves.toBe(false);
    await expect(matches({ not: [yes, no] }, { yes: true, no: false })).resolves.toBe(true);
    await expect(matches({ not: [yes, no] }, { yes: true, no: true })).resolves.toBe(false);
    await expect(matches({ not: [] } as unknown as Condition, {})).resolves.toBe(false);
  });

  it("supports nested OR and stringified conditions defensively", async () => {
    const condition = {
      or: [
        { payload: "country", operator: "equals", value: "NL" },
        { payload: "country", operator: "equals", value: "DE" },
      ],
    } as Condition;
    await expect(matches(JSON.stringify(condition), { country: "DE" })).resolves.toBe(true);
    await expect(matches("not-json", {})).resolves.toBe(false);
    await expect(matches("null", {})).resolves.toBe(false);
    await expect(matches("[]", {})).resolves.toBe(false);
    await expect(matches('{"and":[]}', {})).resolves.toBe(false);
    await expect(matches("*", {})).resolves.toBe(true);
  });

  it("keeps cached global and sticky regular expressions deterministic", async () => {
    for (const operator of ["matches", "notMatches"] as const) {
      const e = instance({
        payload: "value",
        operator,
        value: "hello",
        regexFlags: "g",
      });
      try {
        const expected = operator === "matches";
        await expect(e.track("test", { value: "hello" })).resolves.toEqual(
          expected ? { value: "hello" } : null,
        );
        await expect(e.track("test", { value: "hello" })).resolves.toEqual(
          expected ? { value: "hello" } : null,
        );
      } finally {
        await e.close();
      }
    }
  });

  it("treats invalid regular expressions as non-matches", async () => {
    await expect(
      matches({ payload: "value", operator: "matches", value: "[" }, { value: "hello" }),
    ).resolves.toBe(false);
  });

  it("caches malformed stringified conditions and clears the cache for a new datafile", async () => {
    const error = jest.spyOn(console, "error").mockImplementation(() => undefined);
    const datafile: DatafileContent = {
      schemaVersion: "1",
      revision: "1",
      attributes: {},
      destinations: {},
      effects: {},
      events: { test: { skipValidation: true, conditions: "not-json" } },
    };
    const e = createEventvisor({ datafile, logLevel: "error" });
    try {
      await e.track("test", {});
      await e.track("test", {});
      expect(error).toHaveBeenCalledTimes(1);
      await e.setDatafile({ ...datafile, revision: "2" }, true);
      await e.track("test", {});
      expect(error).toHaveBeenCalledTimes(2);
    } finally {
      error.mockRestore();
      await e.close();
    }
  });
});
