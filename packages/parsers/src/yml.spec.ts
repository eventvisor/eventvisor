import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { ymlParser } from "./yml";

describe("ymlParser", () => {
  it("parses and writes YAML", () => {
    const value = { foo: 1, items: ["a", "b"] };
    expect(ymlParser.parse(ymlParser.stringify(value))).toEqual(value);
  });

  it("preserves comments while applying the supplied object exactly", () => {
    const directory = mkdtempSync(join(tmpdir(), "eventvisor-parser-"));
    const filePath = join(directory, "event.yml");
    const before =
      "description: Before # description comment\nremoved: value\nnested:\n  kept: Before # kept comment\n";
    writeFileSync(filePath, before);

    const output = ymlParser.stringify(
      { description: "After", nested: { kept: "After", added: true } },
      filePath,
    );

    expect(output).toBe(
      "description: After # description comment\nnested:\n  kept: After # kept comment\n  added: true\n",
    );
    expect(readFileSync(filePath, "utf8")).toBe(before);
    rmSync(directory, { recursive: true, force: true });
  });

  it("rejects a primitive root when preserving an existing document", () => {
    const directory = mkdtempSync(join(tmpdir(), "eventvisor-parser-"));
    const filePath = join(directory, "event.yml");
    writeFileSync(filePath, "description: Before\n");
    expect(() => ymlParser.stringify("After", filePath)).toThrow(
      "Cannot set root document to a primitive value",
    );
    rmSync(directory, { recursive: true, force: true });
  });
});
