import type { Dependencies } from "../dependencies";

jest.mock("chalk", () => ({
  __esModule: true,
  default: {
    bold: {
      red: {
        underline: jest.fn((value: string) => value),
      },
    },
  },
}));

import { lintProject } from "./lintProject";

function createDeps(testContent: Record<string, any>): Dependencies {
  return {
    rootDirectoryPath: "/tmp/eventvisor",
    projectConfig: {
      eventsDirectoryPath: "/tmp/eventvisor/events",
      attributesDirectoryPath: "/tmp/eventvisor/attributes",
      destinationsDirectoryPath: "/tmp/eventvisor/destinations",
      effectsDirectoryPath: "/tmp/eventvisor/effects",
      schemasDirectoryPath: "/tmp/eventvisor/schemas",
      testsDirectoryPath: "/tmp/eventvisor/tests",
      targetsDirectoryPath: "/tmp/eventvisor/targets",
      setsDirectoryPath: "/tmp/eventvisor/sets",
      datafilesDirectoryPath: "/tmp/eventvisor/datafiles",
      systemDirectoryPath: "/tmp/eventvisor/.eventvisor",
      catalogExportDirectoryPath: "/tmp/eventvisor/out",
      datafileNamePattern: "eventvisor-%s.json",
      tags: ["all"],
      sets: false,
      adapter: class {} as any,
      plugins: [],
      parser: { extension: "yml", parse: jest.fn(), stringify: jest.fn() },
      prettyDatafile: false,
      stringify: true,
      onValidationFailure: "drop",
    },
    datasource: {
      listAttributes: jest.fn().mockResolvedValue([]),
      listEvents: jest.fn().mockResolvedValue(["page_view"]),
      listDestinations: jest.fn().mockResolvedValue([]),
      listEffects: jest.fn().mockResolvedValue([]),
      listSchemas: jest.fn().mockResolvedValue([]),
      listTests: jest.fn().mockResolvedValue(["events/page_view.spec"]),
      listTargets: jest.fn().mockResolvedValue([]),
      readEvent: jest.fn().mockResolvedValue({
        description: "Page view",
        tags: ["all"],
        type: "object",
        properties: {
          url: {
            type: "string",
          },
        },
      }),
      readSchema: jest.fn(),
      readTest: jest.fn().mockResolvedValue(testContent),
    } as unknown as Dependencies["datasource"],
    options: {},
  };
}

describe("lintProject", () => {
  let logSpy: jest.SpyInstance;

  beforeEach(() => {
    logSpy = jest.spyOn(console, "log").mockImplementation(() => undefined);
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it("accepts supported destination tag assertions", async () => {
    const deps = createDeps({
      event: "page_view",
      assertions: [
        {
          expectedDestinationsByTag: {
            marketing: ["console"],
          },
        },
      ],
    });

    const result = await lintProject(deps);

    expect(result).toBe(true);
    expect(deps.datasource.listTests).toHaveBeenCalled();
    expect(deps.datasource.readTest).toHaveBeenCalledWith("events/page_view.spec");
  });

  it("supports filtering by entityType=test", async () => {
    const deps = createDeps({
      event: "page_view",
      assertions: [
        {
          track: {
            url: "https://example.com",
          },
          expectedToBeValid: true,
        },
      ],
    });

    const result = await lintProject(deps, { entityType: "test" });

    expect(result).toBe(true);
    expect(deps.datasource.listAttributes).toHaveBeenCalled();
    expect(deps.datasource.listEvents).toHaveBeenCalled();
    expect(deps.datasource.listDestinations).toHaveBeenCalled();
    expect(deps.datasource.listEffects).toHaveBeenCalled();
    expect(deps.datasource.listTests).toHaveBeenCalled();
    expect(deps.datasource.readTest).toHaveBeenCalledWith("events/page_view.spec");
  });

  it("accepts reusable schemas and resolves them before semantic validation", async () => {
    const deps = createDeps({
      event: "page_view",
      assertions: [{ track: { location: { path: "/home" } }, expectedToBeValid: true }],
    });
    (deps.datasource.listSchemas as jest.Mock).mockResolvedValue(["page"]);
    (deps.datasource.readSchema as jest.Mock).mockResolvedValue({
      type: "object",
      properties: { location: { type: "object", properties: { path: { type: "string" } } } },
    });
    (deps.datasource.readEvent as jest.Mock).mockResolvedValue({
      description: "Page view",
      tags: ["all"],
      schema: "page",
      transforms: [{ type: "trim", target: "location.path" }],
    });

    await expect(lintProject(deps)).resolves.toBe(true);
  });

  it("rejects missing reusable schema references", async () => {
    const deps = createDeps({
      event: "page_view",
      assertions: [{ track: {}, expectedToBeValid: true }],
    });
    (deps.datasource.readEvent as jest.Mock).mockResolvedValue({
      description: "Page view",
      tags: ["all"],
      schema: "missing",
    });

    await expect(lintProject(deps)).resolves.toBe(false);
  });

  it("rejects circular reusable schemas", async () => {
    const deps = createDeps({
      event: "page_view",
      assertions: [{ track: {}, expectedToBeValid: true }],
    });
    (deps.datasource.listSchemas as jest.Mock).mockResolvedValue(["a", "b"]);
    (deps.datasource.readSchema as jest.Mock).mockImplementation(async (key: string) => ({
      schema: key === "a" ? "b" : "a",
    }));
    (deps.datasource.readEvent as jest.Mock).mockResolvedValue({
      description: "Page view",
      tags: ["all"],
      schema: "a",
    });

    await expect(lintProject(deps)).resolves.toBe(false);
  });

  it("rejects a missing project-level quarantine destination", async () => {
    const deps = createDeps({
      event: "page_view",
      assertions: [{ track: {}, expectedToBeValid: true }],
    });
    deps.projectConfig.onValidationFailure = {
      action: "quarantine",
      destination: "invalidEvents",
    };

    await expect(lintProject(deps)).resolves.toBe(false);
  });
});
