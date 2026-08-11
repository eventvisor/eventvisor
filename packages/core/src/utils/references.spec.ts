import { containsExactString } from "./references";

describe("reference utilities", () => {
  it("matches exact strings recursively", () => {
    expect(containsExactString({ nested: ["userId"] }, "userId")).toBe(true);
  });

  it("does not match partial strings", () => {
    expect(containsExactString({ source: "userIdLong" }, "userId")).toBe(false);
  });
});
