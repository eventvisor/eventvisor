import * as sdk from "./index.js";

describe("SDK root exports", () => {
  it("keeps the runtime API intentionally small", () => {
    expect(Object.keys(sdk).sort()).toEqual(["createEventvisor"]);
    expect(typeof sdk.createEventvisor).toBe("function");
  });
});
