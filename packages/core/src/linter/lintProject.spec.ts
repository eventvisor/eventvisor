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
      statesDirectoryPath: "/tmp/eventvisor/states",
      effectsDirectoryPath: "/tmp/eventvisor/effects",
      testsDirectoryPath: "/tmp/eventvisor/tests",
      datafilesDirectoryPath: "/tmp/eventvisor/datafiles",
      systemDirectoryPath: "/tmp/eventvisor/.eventvisor",
      catalogExportDirectoryPath: "/tmp/eventvisor/out",
      datafileNamePattern: "eventvisor-%s.json",
      tags: ["all"],
      adapter: class {},
      plugins: [],
      parser: { extension: "yml", parse: jest.fn(), stringify: jest.fn() },
      prettyDatafile: false,
      stringify: true,
    },
    datasource: {
      listAttributes: jest.fn().mockResolvedValue([]),
      listEvents: jest.fn().mockResolvedValue(["page_view"]),
      listDestinations: jest.fn().mockResolvedValue([]),
      listEffects: jest.fn().mockResolvedValue([]),
      listTests: jest.fn().mockResolvedValue(["events/page_view.spec"]),
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

  it("includes test specs in linting", async () => {
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

    expect(result).toBe(false);
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
});
