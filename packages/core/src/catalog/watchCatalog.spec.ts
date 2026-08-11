import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import type { ProjectConfig } from "../config";
import {
  createCatalogInputSnapshot,
  getCatalogInputWatchPaths,
  getCatalogSnapshotChanges,
} from "./watchCatalog";

function projectConfig(root: string, sets = false) {
  const directory = (name: string) => path.join(root, name);
  return {
    sets,
    setsDirectoryPath: directory("sets"),
    eventsDirectoryPath: directory("events"),
    attributesDirectoryPath: directory("attributes"),
    destinationsDirectoryPath: directory("destinations"),
    effectsDirectoryPath: directory("effects"),
    schemasDirectoryPath: directory("schemas"),
    testsDirectoryPath: directory("tests"),
    targetsDirectoryPath: directory("targets"),
  } as ProjectConfig;
}

describe("Catalog input watching", () => {
  it("watches definition directories for regular projects and the Sets tree for Set projects", () => {
    const root = "/tmp/eventvisor-project";
    const regularPaths = getCatalogInputWatchPaths(root, projectConfig(root));
    expect(regularPaths).toContain(path.join(root, "eventvisor.config.js"));
    expect(regularPaths).toContain(path.join(root, "events"));
    expect(regularPaths).not.toContain(path.join(root, "sets"));

    const setPaths = getCatalogInputWatchPaths(root, projectConfig(root, true));
    expect(setPaths).toEqual([path.join(root, "eventvisor.config.js"), path.join(root, "sets")]);
  });

  it("detects created, changed, and deleted files while ignoring generated output", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "eventvisor-catalog-watch-"));
    const config = projectConfig(root);
    const events = path.join(root, "events");
    const output = path.join(root, "out");
    fs.mkdirSync(events, { recursive: true });
    fs.mkdirSync(output, { recursive: true });
    const eventPath = path.join(events, "checkout.yml");
    fs.writeFileSync(eventPath, "description: Checkout\n");
    fs.writeFileSync(path.join(output, "manifest.json"), "{}");

    const first = createCatalogInputSnapshot(root, config, [output]);
    expect(first.has(eventPath)).toBe(true);
    expect([...first.keys()].some((filePath) => filePath.startsWith(output))).toBe(false);

    fs.writeFileSync(eventPath, "description: Checkout completed\n");
    const attributePath = path.join(root, "attributes", "userId.yml");
    fs.mkdirSync(path.dirname(attributePath), { recursive: true });
    fs.writeFileSync(attributePath, "type: string\n");
    const second = createCatalogInputSnapshot(root, config, [output]);
    expect(getCatalogSnapshotChanges(first, second)).toEqual(
      expect.arrayContaining([eventPath, attributePath]),
    );

    fs.rmSync(eventPath);
    const third = createCatalogInputSnapshot(root, config, [output]);
    expect(getCatalogSnapshotChanges(second, third)).toContain(eventPath);
  });
});
