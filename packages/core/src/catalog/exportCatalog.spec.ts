import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import type { Catalog } from "@eventvisor/types";

jest.mock("./generateHistory", () => ({ generateHistory: jest.fn() }));
jest.mock("./getRepoDetails", () => ({ getRepoDetails: jest.fn() }));
jest.mock("./buildCatalog", () => ({ buildCatalog: jest.fn() }));
jest.mock("../sets", () => ({ getProjectSetExecutions: jest.fn() }));

import { generateHistory } from "./generateHistory";
import { buildCatalog } from "./buildCatalog";
import {
  assertSafeCatalogOutputPath,
  exportCatalog,
  normalizeCatalogBasePath,
} from "./exportCatalog";
import { getRepoDetails } from "./getRepoDetails";
import { getProjectSetExecutions } from "../sets";

const mockedHistory = generateHistory as jest.MockedFunction<typeof generateHistory>;
const mockedCatalog = buildCatalog as jest.MockedFunction<typeof buildCatalog>;
const mockedExecutions = getProjectSetExecutions as jest.MockedFunction<
  typeof getProjectSetExecutions
>;
const mockedRepoDetails = getRepoDetails as jest.MockedFunction<typeof getRepoDetails>;

describe("normalizeCatalogBasePath", () => {
  it("normalizes safe paths and rejects traversal", () => {
    expect(normalizeCatalogBasePath(" /event-catalog/ ")).toBe("/event-catalog");
    expect(normalizeCatalogBasePath("/")).toBe("");
    expect(() => normalizeCatalogBasePath("../catalog")).toThrow(
      "Catalog base path cannot contain '..'.",
    );
  });
});

function catalog(description: string): Catalog {
  return {
    projectConfig: { tags: ["web"], sets: false },
    links: {
      event: "https://example.com/events/{{name}}.yml",
      attribute: "",
      destination: "",
      effect: "",
      schema: "",
      target: "",
      test: "",
      commit: "https://example.com/commit/{{hash}}",
    },
    entities: {
      events: {
        "checkout/order": { description, type: "object", tags: ["web"], targets: ["web"] },
      },
      attributes: {},
      destinations: {},
      effects: {},
      schemas: { identifier: { description: "Identifier", type: "string", targets: ["web"] } },
      targets: { web: { description: "Web", includeEvents: "*" } },
      tests: { "events/checkout": { event: "checkout/order", assertions: [{ track: {} }] } },
    },
    usages: { "events:checkout/order": [], "targets:web": [] },
  } as Catalog;
}

function deps(root: string, sets: boolean) {
  const projectConfig = { catalogExportDirectoryPath: root, sets, tags: ["web"] } as any;
  const rootDirectoryPath = `${root}-project`;
  fs.mkdirSync(rootDirectoryPath, { recursive: true });
  return { rootDirectoryPath, projectConfig, datasource: {}, options: {} } as any;
}

describe("exportCatalog", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedRepoDetails.mockReturnValue(undefined);
  });

  it("rejects output directories that could delete project or user files", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "eventvisor-catalog-safe-"));
    expect(() => assertSafeCatalogOutputPath(root, root)).toThrow("unsafe directory");
    expect(() => assertSafeCatalogOutputPath(path.join(root, "project"), root)).toThrow(
      "unsafe directory",
    );
    expect(() => assertSafeCatalogOutputPath(root, path.parse(root).root)).toThrow(
      "unsafe directory",
    );
  });

  it("writes compact indexes and slash namespaced entity details", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "eventvisor-catalog-export-"));
    const input = deps(root, false);
    mockedExecutions.mockResolvedValue([
      { set: "", projectConfig: input.projectConfig, datasource: input.datasource },
    ] as any);
    mockedHistory.mockResolvedValue([
      {
        commit: "abc",
        author: "A",
        timestamp: "2026-01-01",
        entities: [{ type: "event", key: "checkout/order" }],
      },
      {
        commit: "def",
        author: "B",
        timestamp: "2026-01-02",
        entities: [{ type: "test", key: "events/checkout" }],
      },
    ]);
    mockedCatalog.mockResolvedValue(catalog("Root event"));

    await exportCatalog(input);

    const manifest = JSON.parse(fs.readFileSync(path.join(root, "data/manifest.json"), "utf8"));
    const detail = JSON.parse(
      fs.readFileSync(path.join(root, "data/root/entities/event/checkout/order.json"), "utf8"),
    );
    expect(manifest.sets).toBe(false);
    expect(manifest.router).toBe("browser");
    expect(detail.entity.description).toBe("Root event");
    expect(detail.tests).toHaveLength(1);
    expect(fs.existsSync(path.join(root, ".eventvisor-catalog"))).toBe(true);
    const schemaDetail = JSON.parse(
      fs.readFileSync(path.join(root, "data/root/entities/schema/identifier.json"), "utf8"),
    );
    expect(schemaDetail.type).toBe("schema");
    expect(schemaDetail.entity.targets).toEqual(["web"]);
    expect(
      fs.existsSync(path.join(root, "data/root/entities/event/checkout/order/history/page-1.json")),
    ).toBe(true);
    const entityHistory = JSON.parse(
      fs.readFileSync(
        path.join(root, "data/root/entities/event/checkout/order/history/page-1.json"),
        "utf8",
      ),
    );
    expect(entityHistory.entries.map((entry) => entry.commit)).toEqual(["abc", "def"]);
  });

  it("writes a separate index for every Set in display order", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "eventvisor-catalog-sets-"));
    const input = deps(root, true);
    mockedExecutions.mockResolvedValue(
      ["production", "development", "staging"].map((set) => ({
        set,
        projectConfig: {
          ...input.projectConfig,
          catalogExportDirectoryPath: path.join(root, "sets", set),
        },
        datasource: { set },
      })) as any,
    );
    mockedHistory.mockResolvedValue([]);
    mockedCatalog.mockImplementation(async (execution: any) => catalog(execution.datasource.set));

    await exportCatalog(input);

    const manifest = JSON.parse(fs.readFileSync(path.join(root, "data/manifest.json"), "utf8"));
    expect(manifest.setKeys).toEqual(["development", "staging", "production"]);
    for (const set of manifest.setKeys)
      expect(fs.existsSync(path.join(root, "data/sets", set, "index.json"))).toBe(true);
  });

  it("exports repository metadata used by the Catalog header", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "eventvisor-catalog-links-"));
    const input = deps(root, false);
    mockedExecutions.mockResolvedValue([
      { set: "", projectConfig: input.projectConfig, datasource: input.datasource },
    ] as any);
    mockedHistory.mockResolvedValue([]);
    const linkedCatalog = catalog("Root event");
    linkedCatalog.links!.event =
      "https://github.com/eventvisor/eventvisor/blob/main/events/{{name}}.yml";
    mockedCatalog.mockResolvedValue(linkedCatalog);
    mockedRepoDetails.mockReturnValue({
      provider: "github",
      repository: "https://github.com/eventvisor/eventvisor",
      branch: "main",
      remoteUrl: "git@github.com:eventvisor/eventvisor.git",
      blobUrl: "https://github.com/eventvisor/eventvisor/blob/main/{{blobPath}}",
      commitUrl: "https://github.com/eventvisor/eventvisor/commit/{{hash}}",
      topLevelPath: root,
    });

    await exportCatalog(input);

    const manifest = JSON.parse(fs.readFileSync(path.join(root, "data/manifest.json"), "utf8"));
    const detail = JSON.parse(
      fs.readFileSync(path.join(root, "data/root/entities/event/checkout/order.json"), "utf8"),
    );
    expect(manifest.links).toEqual({
      provider: "github",
      repository: "https://github.com/eventvisor/eventvisor",
      source: "https://github.com/eventvisor/eventvisor/blob/main/{{blobPath}}",
      commit: "https://example.com/commit/{{hash}}",
    });
    expect(detail.sourcePath).toBe("events/checkout/order.yml");
    expect(detail.sourceUrl).toBeUndefined();
  });

  it("supports a data-only export to a custom development directory", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "eventvisor-catalog-dev-"));
    const defaultOutput = path.join(root, "out");
    const developmentOutput = path.join(root, ".catalog-dev");
    const input = deps(defaultOutput, false);
    input.rootDirectoryPath = root;
    input.options = { outDir: developmentOutput, assets: false };
    fs.mkdirSync(developmentOutput, { recursive: true });
    fs.writeFileSync(path.join(developmentOutput, "index.html"), "Vite owns this file");
    mockedExecutions.mockImplementation(
      async (projectConfig, datasource) => [{ set: "", projectConfig, datasource }] as any,
    );
    mockedHistory.mockResolvedValue([]);
    mockedCatalog.mockResolvedValue(catalog("Development event"));

    await exportCatalog(input);

    expect(fs.existsSync(path.join(defaultOutput, "data/manifest.json"))).toBe(false);
    expect(fs.existsSync(path.join(developmentOutput, "data/manifest.json"))).toBe(true);
    expect(fs.readFileSync(path.join(developmentOutput, "index.html"), "utf8")).toBe(
      "Vite owns this file",
    );
    expect(mockedExecutions).toHaveBeenCalledWith(
      expect.objectContaining({ catalogExportDirectoryPath: developmentOutput }),
      input.datasource,
    );
  });

  it("uses hash routing only when explicitly requested", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "eventvisor-catalog-hash-router-"));
    const input = deps(root, false);
    input.options = { hashRouter: true, assets: false };
    mockedExecutions.mockResolvedValue([
      { set: "", projectConfig: input.projectConfig, datasource: input.datasource },
    ] as any);
    mockedHistory.mockResolvedValue([]);
    mockedCatalog.mockResolvedValue(catalog("Hash routed event"));

    await exportCatalog(input);

    const manifest = JSON.parse(fs.readFileSync(path.join(root, "data/manifest.json"), "utf8"));
    expect(manifest.router).toBe("hash");
  });

  it("writes subpath-aware assets and manifest metadata", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "eventvisor-catalog-base-path-"));
    const input = deps(root, false);
    input.options = { basePath: "/event-catalog/" };
    mockedExecutions.mockResolvedValue([
      { set: "", projectConfig: input.projectConfig, datasource: input.datasource },
    ] as any);
    mockedHistory.mockResolvedValue([]);
    mockedCatalog.mockResolvedValue(catalog("Subpath event"));

    await exportCatalog(input);

    const manifest = JSON.parse(fs.readFileSync(path.join(root, "data/manifest.json"), "utf8"));
    const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
    expect(manifest.basePath).toBe("/event-catalog");
    expect(html).toContain('src="/event-catalog/assets/');
    expect(html).toContain('href="/event-catalog/img/logo.png"');
  });
});
