import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { getProjectConfig } from "../config";
import { Datasource } from "../datasource";
import { buildCatalog } from "./buildCatalog";

function write(root: string, relative: string, content: string) {
  const file = path.join(root, relative);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

describe("buildCatalog", () => {
  it("includes targets, test specs, dependency-aware memberships and usages", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "eventvisor-catalog-"));
    write(root, "eventvisor.config.js", 'module.exports = { tags: ["web", "internal"] };');
    write(root, "attributes/userId.yml", "description: User\ntags: [internal]\ntype: string\n");
    write(
      root,
      "events/checkout.yml",
      "description: Checkout\ntags: [web]\ntype: object\nconditions:\n  attribute: userId\n  operator: exists\n",
    );
    write(root, "targets/web.yml", "description: Web\ntag: web\nincludeAttributes: none\n");
    write(root, "tests/events/checkout.spec.yml", "event: checkout\nassertions:\n  - track: {}\n");
    const projectConfig = getProjectConfig(root);
    const datasource = new Datasource(projectConfig, root);
    const catalog = await buildCatalog(
      { rootDirectoryPath: root, projectConfig, datasource, options: {} },
      [],
      undefined,
    );

    expect(catalog.entities.targets.web).toBeDefined();
    expect(catalog.entities.tests["events/checkout.spec"].key).toBe("events/checkout.spec");
    expect(catalog.entities.events.checkout.targets).toEqual(["web"]);
    expect(catalog.entities.attributes.userId.targets).toEqual(["web"]);
    expect(catalog.usages["attributes:userId"]).toContainEqual({ type: "event", key: "checkout" });
  });
});
