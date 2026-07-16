import { parseJsonOption } from "./parseJsonOption";

describe("parseJsonOption", () => {
  it("returns the fallback when the option is absent", () => {
    expect(parseJsonOption(undefined, {}, "Value")).toEqual({});
  });

  it("parses JSON and reports malformed values without leaking parser errors", () => {
    expect(parseJsonOption('{"ok":true}', {}, "Value")).toEqual({ ok: true });
    expect(() => parseJsonOption("{", {}, "Value")).toThrow("Value must be valid JSON.");
  });
});
