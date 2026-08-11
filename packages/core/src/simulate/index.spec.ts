import { parseAttributesOption } from "./index";

describe("simulate options", () => {
  it("accepts an attributes object", () => {
    expect(parseAttributesOption('{"country":"NL"}')).toEqual({ country: "NL" });
  });

  it.each(["null", "[]", '"NL"'])("rejects non-object attributes: %s", (value) => {
    expect(() => parseAttributesOption(value)).toThrow("Attributes must be a JSON object.");
  });
});
