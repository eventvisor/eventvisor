import * as path from "path";
import { resolveRootDirectoryPath } from "./rootDirectory";

describe("resolveRootDirectoryPath", () => {
  it.each([
    ["--rootDirectoryPath=fixtures/project"],
    ["--root-directory-path=fixtures/project"],
    ["--projectDirectoryPath=fixtures/project"],
    ["--rootDirectoryPath", "fixtures/project"],
  ])("accepts common root directory forms", (...args) => {
    expect(resolveRootDirectoryPath(args, "/fallback")).toBe(path.resolve("fixtures/project"));
  });

  it("keeps the current directory when no override is provided", () => {
    expect(resolveRootDirectoryPath(["lint"], "/fallback")).toBe("/fallback");
  });
});
