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
import { exportCatalog } from "./exportCatalog";
import { getProjectSetExecutions } from "../sets";

const mockedHistory = generateHistory as jest.MockedFunction<typeof generateHistory>;
const mockedCatalog = buildCatalog as jest.MockedFunction<typeof buildCatalog>;
const mockedExecutions = getProjectSetExecutions as jest.MockedFunction<
  typeof getProjectSetExecutions
>;

function catalog(description: string): Catalog {
  return {
    projectConfig: { tags: ["web"], sets: false },
    links: {
      event: "https://example.com/events/{{name}}.yml",
      attribute: "",
      destination: "",
      effect: "",
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
      targets: { web: { description: "Web", includeEvents: "*" } },
      tests: { "events/checkout": { event: "checkout/order", assertions: [{ track: {} }] } },
    },
    usages: { "events:checkout/order": [], "targets:web": [] },
  } as Catalog;
}

function deps(root: string, sets: boolean) {
  const projectConfig = { catalogExportDirectoryPath: root, sets, tags: ["web"] } as any;
  return { rootDirectoryPath: root, projectConfig, datasource: {}, options: {} } as any;
}

describe("exportCatalog", () => {
  beforeEach(() => jest.clearAllMocks());

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
    ]);
    mockedCatalog.mockResolvedValue(catalog("Root event"));

    await exportCatalog(input);

    const manifest = JSON.parse(fs.readFileSync(path.join(root, "data/manifest.json"), "utf8"));
    const detail = JSON.parse(
      fs.readFileSync(path.join(root, "data/root/entities/event/checkout/order.json"), "utf8"),
    );
    expect(manifest.sets).toBe(false);
    expect(detail.entity.description).toBe("Root event");
    expect(detail.tests).toHaveLength(1);
    expect(
      fs.existsSync(path.join(root, "data/root/entities/event/checkout/order/history/page-1.json")),
    ).toBe(true);
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
});
