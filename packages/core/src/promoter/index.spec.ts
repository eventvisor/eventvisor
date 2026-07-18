import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { getProjectConfig } from "../config";
import { Datasource } from "../datasource";
import { promoteProjectSets } from "./index";

function write(root: string, relativePath: string, content: string) {
  const file = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

function project() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "eventvisor-promote-"));
  write(
    root,
    "eventvisor.config.js",
    'module.exports = { sets: true, tags: ["all"], promotionFlows: [{ from: "development", to: "staging" }] };',
  );
  for (const set of ["development", "staging"]) {
    write(root, `sets/${set}/targets/all.yml`, "description: All\nincludeEvents: '*'\n");
  }
  const projectConfig = getProjectConfig(root);
  return {
    root,
    deps: {
      rootDirectoryPath: root,
      projectConfig,
      datasource: new Datasource(projectConfig, root),
      options: {},
    },
  };
}

describe("set promotion", () => {
  it("previews by default, then applies selected entities and dependencies", async () => {
    const { root, deps } = project();
    write(
      root,
      "sets/development/attributes/userId.yml",
      "description: User\ntags: [all]\ntype: string\n",
    );
    write(
      root,
      "sets/development/events/checkout.yml",
      "description: Checkout\ntags: [all]\ntype: object\nrequiredAttributes: [userId]\n",
    );
    write(
      root,
      "sets/development/tests/events/checkout.spec.yml",
      "event: checkout\nassertions:\n  - description: valid checkout\n    track: {}\n    expectedToBeValid: true\n",
    );
    write(
      root,
      "sets/development/effects/checkoutAudit.yml",
      "description: Audit\ntags: [all]\non:\n  event_tracked: [checkout]\nsteps: []\n",
    );
    const log = jest.spyOn(console, "log").mockImplementation(() => undefined);
    try {
      await promoteProjectSets(deps, {
        from: "development",
        to: "staging",
        includeEvents: "checkout",
      });
      expect(fs.existsSync(path.join(root, "sets/staging/events/checkout.yml"))).toBe(false);
      await promoteProjectSets(deps, {
        from: "development",
        to: "staging",
        includeEvents: "checkout",
        apply: true,
      });
      expect(fs.existsSync(path.join(root, "sets/staging/events/checkout.yml"))).toBe(true);
      expect(fs.existsSync(path.join(root, "sets/staging/attributes/userId.yml"))).toBe(true);
      expect(fs.existsSync(path.join(root, "sets/staging/tests/events/checkout.spec.yml"))).toBe(
        true,
      );
      expect(fs.existsSync(path.join(root, "sets/staging/effects/checkoutAudit.yml"))).toBe(true);
    } finally {
      log.mockRestore();
    }
  });

  it("enforces flows and protects existing non-promotable entities", async () => {
    const { root, deps } = project();
    await expect(promoteProjectSets(deps, { from: "staging", to: "development" })).rejects.toThrow(
      "not allowed",
    );
    write(
      root,
      "sets/development/attributes/userId.yml",
      "description: User\ntags: [all]\ntype: string\npromotable: false\n",
    );
    write(
      root,
      "sets/development/events/checkout.yml",
      "description: Checkout\ntags: [all]\ntype: object\nrequiredAttributes: [userId]\n",
    );
    const log = jest.spyOn(console, "log").mockImplementation(() => undefined);
    try {
      await promoteProjectSets(deps, {
        from: "development",
        to: "staging",
        includeEvents: "checkout",
        apply: true,
      });
      expect(fs.existsSync(path.join(root, "sets/staging/attributes/userId.yml"))).toBe(true);

      write(
        root,
        "sets/development/attributes/userId.yml",
        "description: Changed\ntags: [all]\ntype: string\npromotable: false\n",
      );
      await promoteProjectSets(deps, {
        from: "development",
        to: "staging",
        includeEvents: "checkout",
        apply: true,
      });
      expect(
        fs.readFileSync(path.join(root, "sets/staging/attributes/userId.yml"), "utf8"),
      ).toContain("description: User");
    } finally {
      log.mockRestore();
    }
  });

  it("supports fail-fast conflicts without mutating the destination", async () => {
    const { root, deps } = project();
    write(
      root,
      "sets/development/events/checkout.yml",
      "description: Source\ntags: [all]\ntype: object\n",
    );
    write(
      root,
      "sets/staging/events/checkout.yml",
      "description: Destination\ntags: [all]\ntype: object\n",
    );
    await expect(
      promoteProjectSets(deps, {
        from: "development",
        to: "staging",
        includeEvents: "checkout",
        conflicts: "fail",
        apply: true,
      }),
    ).rejects.toThrow("Promotion conflicts");
    expect(fs.readFileSync(path.join(root, "sets/staging/events/checkout.yml"), "utf8")).toContain(
      "Destination",
    );
  });

  it("supports exclusion-only filters, Target patterns, and validates conflict policies", async () => {
    const { root, deps } = project();
    write(
      root,
      "sets/development/events/checkout.yml",
      "description: Checkout\ntags: [all]\ntype: object\n",
    );
    write(
      root,
      "sets/development/events/internal.yml",
      "description: Internal\ntags: [all]\ntype: object\n",
    );
    write(
      root,
      "sets/development/targets/web-public.yml",
      "description: Web\nincludeEvents: checkout\n",
    );
    const log = jest.spyOn(console, "log").mockImplementation(() => undefined);
    try {
      await promoteProjectSets(deps, {
        from: "development",
        to: "staging",
        excludeEvents: "internal",
        apply: true,
      });
      expect(fs.existsSync(path.join(root, "sets/staging/events/checkout.yml"))).toBe(true);
      expect(fs.existsSync(path.join(root, "sets/staging/events/internal.yml"))).toBe(false);

      await promoteProjectSets(deps, {
        from: "development",
        to: "staging",
        target: "web-*",
      });
      await expect(
        promoteProjectSets(deps, {
          from: "development",
          to: "staging",
          conflicts: "unknown" as any,
        }),
      ).rejects.toThrow("Invalid --conflicts");
    } finally {
      log.mockRestore();
    }
  });
});
