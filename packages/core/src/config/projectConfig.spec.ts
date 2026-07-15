import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { getProjectConfig, getProjectConfigForSet } from "./projectConfig";

function config(source: string) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "eventvisor-config-"));
  fs.writeFileSync(path.join(root, "eventvisor.config.js"), `module.exports = ${source}`);
  return { root, read: () => getProjectConfig(root) };
}

describe("project configuration", () => {
  it("validates public configuration values", () => {
    expect(() => config("{ tags: [] }").read()).toThrow("Invalid tags");
    expect(() => config('{ tags: ["web", "web"] }').read()).toThrow("unique");
    expect(() => config('{ datafileNamePattern: "datafile.json" }').read()).toThrow("%s");
    expect(() => config('{ prettyDatafile: "yes" }').read()).toThrow("datafile options");
    expect(() => config("{ eventsDirectoryPath: false }").read()).toThrow("eventsDirectoryPath");
  });

  it("isolates generated state, datafiles and Catalog output for sets", () => {
    const { root, read } = config('{ sets: true, tags: ["all"] }');
    const set = getProjectConfigForSet(read(), "admin");
    expect(set.eventsDirectoryPath).toBe(path.join(root, "sets/admin/events"));
    expect(set.systemDirectoryPath).toBe(path.join(root, ".eventvisor/sets/admin"));
    expect(set.datafilesDirectoryPath).toBe(path.join(root, "datafiles/sets/admin"));
    expect(set.catalogExportDirectoryPath).toBe(path.join(root, "out/sets/admin"));
  });
});
