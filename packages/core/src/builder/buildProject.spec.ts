import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { getProjectConfig } from "../config";
import { Datasource } from "../datasource";
import { buildDatafile, buildProject, matchesPattern } from "./buildProject";

function write(root: string, relative: string, content: string) {
  const file = path.join(root, relative);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

function project(sets = false) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "eventvisor-builder-"));
  write(root, "eventvisor.config.js", `module.exports = { tags: ["all", "web"], sets: ${sets} };`);
  return root;
}

function deps(root: string) {
  const projectConfig = getProjectConfig(root);
  return {
    rootDirectoryPath: root,
    projectConfig,
    datasource: new Datasource(projectConfig, root),
    options: {},
  };
}

describe("buildProject targets and sets", () => {
  it("matches exact, wildcard and global patterns", () => {
    expect(matchesPattern("checkout.started", "checkout.*")).toBe(true);
    expect(matchesPattern("checkout.started", "checkout.completed")).toBe(false);
    expect(matchesPattern("anything", "*")).toBe(true);
  });

  it("reports unknown targets clearly", async () => {
    const root = project();
    await expect(buildDatafile(deps(root), { target: "missing" })).rejects.toThrow(
      'Unknown target "missing".',
    );
  });

  it("writes namespaced target keys to a safe single file", async () => {
    const root = project();
    write(root, "events/page.yml", "description: Page\ntags: [web]\ntype: object\n");
    write(root, "targets/apps/web.yml", "description: Web\nincludeEvents: page\n");
    await buildProject(deps(root), { target: "apps/web" });
    expect(fs.existsSync(path.join(root, "datafiles/eventvisor-target-apps%2Fweb.json"))).toBe(
      true,
    );
  });

  it("combines tag and target filters and includes runtime dependencies", async () => {
    const root = project();
    write(root, "attributes/userId.yml", "description: User\ntags: [web]\ntype: string\n");
    write(root, "attributes/internal.yml", "description: Internal\ntags: [all]\ntype: string\n");
    write(
      root,
      "events/checkout.started.yml",
      [
        "description: Checkout",
        "tags: [web]",
        "type: object",
        "conditions:",
        "  attribute: userId",
        "  operator: exists",
        "destinations:",
        "  audit: true",
        "",
      ].join("\n"),
    );
    write(root, "events/admin.opened.yml", "description: Admin\ntags: [all]\ntype: object\n");
    write(root, "destinations/audit.yml", "description: Audit\ntags: [all]\ntransport: console\n");
    write(
      root,
      "effects/checkout.yml",
      [
        "description: Checkout effect",
        "tags: [all]",
        "on:",
        "  event_tracked: [checkout.started]",
        "conditions:",
        "  attribute: internal",
        "  operator: exists",
        "",
      ].join("\n"),
    );
    write(
      root,
      "targets/web.yml",
      "description: Web\ntag: web\nincludeEvents: checkout.*\nincludeAttributes: internal.none\nincludeDestinations: internal.none\nincludeEffects: internal.none\n",
    );

    const datafile = await buildDatafile(deps(root), { target: "web" });
    expect(Object.keys(datafile.events)).toEqual(["checkout.started"]);
    expect(Object.keys(datafile.attributes).sort()).toEqual(["internal", "userId"]);
    expect(Object.keys(datafile.destinations)).toEqual(["audit"]);
    expect(Object.keys(datafile.effects)).toEqual(["checkout"]);
  });

  it("honours explicit target exclusions over dependency closure", async () => {
    const root = project();
    write(
      root,
      "events/checkout.yml",
      "description: Checkout\ntags: [web]\ntype: object\ndestinations:\n  audit: true\n",
    );
    write(root, "destinations/audit.yml", "description: Audit\ntags: [all]\ntransport: console\n");
    write(
      root,
      "targets/web.yml",
      "description: Web\nincludeEvents: checkout\nexcludeDestinations: audit\n",
    );
    const datafile = await buildDatafile(deps(root), { target: "web" });
    expect(Object.keys(datafile.events)).toEqual(["checkout"]);
    expect(Object.keys(datafile.destinations)).toEqual([]);
  });

  it("includes event and attribute triggers required by selected effects", async () => {
    const root = project();
    write(root, "attributes/accountId.yml", "description: Account\ntags: [all]\ntype: string\n");
    write(root, "events/checkout.yml", "description: Checkout\ntags: [all]\ntype: object\n");
    write(
      root,
      "effects/audit.yml",
      [
        "description: Audit",
        "tags: [internal]",
        "on:",
        "  event_tracked: [checkout]",
        "  attribute_set: [accountId]",
        "",
      ].join("\n"),
    );
    write(
      root,
      "targets/audit.yml",
      "description: Audit\nincludeEffects: audit\nincludeEvents: none\nincludeAttributes: none\nincludeDestinations: none\n",
    );

    const datafile = await buildDatafile(deps(root), { target: "audit" });
    expect(Object.keys(datafile.effects)).toEqual(["audit"]);
    expect(Object.keys(datafile.events)).toEqual(["checkout"]);
    expect(Object.keys(datafile.attributes)).toEqual(["accountId"]);
  });

  it("does not restore archived definitions through dependency expansion", async () => {
    const root = project();
    write(root, "attributes/retired.yml", "description: Retired\narchived: true\ntype: string\n");
    write(
      root,
      "events/page.yml",
      "description: Page\ntags: [web]\ntype: object\nconditions:\n  attribute: retired\n  operator: exists\n",
    );
    write(root, "targets/web.yml", "description: Web\nincludeEvents: page\n");

    const datafile = await buildDatafile(deps(root), { target: "web" });
    expect(Object.keys(datafile.events)).toEqual(["page"]);
    expect(Object.keys(datafile.attributes)).toEqual([]);
  });

  it("includes all trigger entities for effects with broad listeners", async () => {
    const root = project();
    write(root, "attributes/userId.yml", "description: User\ntags: [all]\ntype: string\n");
    write(root, "events/page.yml", "description: Page\ntags: [all]\ntype: object\n");
    write(
      root,
      "effects/audit.yml",
      "description: Audit\ntags: [all]\non: [event_tracked, attribute_set]\n",
    );
    write(
      root,
      "targets/audit.yml",
      "description: Audit\nincludeEffects: audit\nincludeEvents: none\nincludeAttributes: none\nincludeDestinations: none\n",
    );

    const datafile = await buildDatafile(deps(root), { target: "audit" });
    expect(Object.keys(datafile.events)).toEqual(["page"]);
    expect(Object.keys(datafile.attributes)).toEqual(["userId"]);
  });

  it("retains required attributes and generic source dependencies", async () => {
    const root = project();
    write(root, "attributes/userId.yml", "description: User\ntype: string\n");
    write(root, "attributes/country.yml", "description: Country\ntype: string\n");
    write(root, "attributes/locale.yml", "description: Locale\ntype: string\n");
    write(
      root,
      "events/page.yml",
      [
        "description: Page",
        "type: object",
        "requiredAttributes: [userId]",
        "conditions:",
        "  and:",
        "    - source: attributes.country",
        "      operator: equals",
        "      value: NL",
        "    - source: effects.audit",
        "      operator: exists",
        "    - source: attributes",
        "      operator: exists",
        "    - source: effects",
        "      operator: exists",
        "",
      ].join("\n"),
    );
    write(root, "effects/audit.yml", "description: Audit\non:\n  event_tracked: []\n");
    write(root, "effects/session.yml", "description: Session\non:\n  attribute_set: []\n");
    write(
      root,
      "targets/web.yml",
      "description: Web\nincludeEvents: page\nincludeAttributes: none\nincludeEffects: none\n",
    );

    const datafile = await buildDatafile(deps(root), { target: "web" });
    expect(Object.keys(datafile.attributes).sort()).toEqual(["country", "locale", "userId"]);
    expect(Object.keys(datafile.effects).sort()).toEqual(["audit", "session"]);
  });

  it("combines CLI tag and target selections using AND semantics", async () => {
    const root = project();
    write(root, "events/web.yml", "description: Web\ntags: [web]\ntype: object\n");
    write(root, "events/internal.yml", "description: Internal\ntags: [all]\ntype: object\n");
    write(root, "targets/application.yml", "description: Application\nincludeEvents: '*'\n");

    await buildProject(deps(root), { tag: "web", target: "application" });
    const output = JSON.parse(
      fs.readFileSync(path.join(root, "datafiles/eventvisor-target-application.json"), "utf8"),
    );
    expect(Object.keys(output.events)).toEqual(["web"]);
    expect(fs.existsSync(path.join(root, "datafiles/eventvisor-tag-web.json"))).toBe(false);
  });

  it("applies project and target condition stringification options", async () => {
    const root = project();
    write(root, "attributes/country.yml", "description: Country\ntags: [web]\ntype: string\n");
    write(
      root,
      "events/page.yml",
      "description: Page\ntags: [web]\ntype: object\nconditions:\n  attribute: country\n  operator: equals\n  value: NL\n",
    );
    write(
      root,
      "targets/readable.yml",
      "description: Readable\nincludeEvents: page\nstringify: false\n",
    );
    const defaultDatafile = await buildDatafile(deps(root), { tag: "web" });
    const readableDatafile = await buildDatafile(deps(root), { target: "readable" });
    expect(typeof defaultDatafile.events.page.conditions).toBe("string");
    expect(readableDatafile.events.page.conditions).toEqual({
      attribute: "country",
      operator: "equals",
      value: "NL",
    });
  });

  it("builds every enabled set in isolated output directories", async () => {
    const root = project(true);
    for (const set of ["consumer", "admin"]) {
      write(root, `sets/${set}/events/page.yml`, "description: Page\ntags: [all]\ntype: object\n");
    }
    await buildProject(deps(root));
    expect(fs.existsSync(path.join(root, "datafiles/sets/consumer/eventvisor-tag-all.json"))).toBe(
      true,
    );
    expect(fs.existsSync(path.join(root, "datafiles/sets/admin/eventvisor-tag-all.json"))).toBe(
      true,
    );
  });
});
