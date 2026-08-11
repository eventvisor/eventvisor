import * as path from "path";
import type { ProjectConfig } from "../config";
import { getEntityFromFilePath } from "./git";

describe("Git entity path mapping", () => {
  const root = path.resolve("/tmp/eventvisor-project");
  const config = {
    parser: { extension: "yml" },
    attributesDirectoryPath: path.join(root, "attributes"),
    eventsDirectoryPath: path.join(root, "events"),
    destinationsDirectoryPath: path.join(root, "destinations"),
    effectsDirectoryPath: path.join(root, "effects"),
    schemasDirectoryPath: path.join(root, "schemas"),
    testsDirectoryPath: path.join(root, "tests"),
    targetsDirectoryPath: path.join(root, "targets"),
  } as ProjectConfig;

  it("preserves nested and namespaced entity keys", () => {
    expect(getEntityFromFilePath(path.join(root, "events/auth/signup.yml"), config)).toEqual({
      type: "event",
      key: "auth/signup",
    });
    expect(getEntityFromFilePath(path.join(root, "targets/apps/web.yml"), config)).toEqual({
      type: "target",
      key: "apps/web",
    });
    expect(getEntityFromFilePath(path.join(root, "schemas/customer/address.yml"), config)).toEqual({
      type: "schema",
      key: "customer/address",
    });
  });

  it("ignores files outside entity directories and files with another extension", () => {
    expect(getEntityFromFilePath(path.join(root, "README.md"), config)).toBeUndefined();
    expect(getEntityFromFilePath(path.join(root, "events/page.json"), config)).toBeUndefined();
  });
});
