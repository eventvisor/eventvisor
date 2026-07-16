import { findUsagePlugin } from "./find-usage";
import { infoPlugin } from "./info";
import { listPlugin } from "./list";

const projectConfig = { sets: false };

describe("inspection command output", () => {
  let log: jest.SpyInstance;

  beforeEach(() => {
    log = jest.spyOn(console, "log").mockImplementation(() => undefined);
  });

  afterEach(() => {
    log.mockRestore();
  });

  it("supports pretty JSON when listing entities", async () => {
    await listPlugin.handler({
      projectConfig,
      datasource: { listEvents: async () => ["page", "checkout"] },
      parsed: { _: ["list"], entityType: "event", json: true, pretty: true },
    } as any);

    expect(log).toHaveBeenCalledWith('[\n  "page",\n  "checkout"\n]');
  });

  it("prints compact info with --json and formatted info with --pretty", async () => {
    const datasource = { readEvent: async () => ({ description: "Page" }) };
    const options = { projectConfig, datasource };

    await infoPlugin.handler({
      ...options,
      parsed: { _: ["info"], entityType: "event", key: "page", json: true },
    } as any);
    expect(log).toHaveBeenLastCalledWith('{"description":"Page"}');

    await infoPlugin.handler({
      ...options,
      parsed: { _: ["info"], entityType: "event", key: "page", json: true, pretty: true },
    } as any);
    expect(log).toHaveBeenLastCalledWith('{\n  "description": "Page"\n}');
  });

  it("supports pretty JSON for usage results", async () => {
    const empty = async () => [];
    const datasource = {
      listEvents: empty,
      listAttributes: async () => ["userId"],
      listDestinations: empty,
      listEffects: empty,
      listSchemas: empty,
      listTargets: empty,
      listTests: empty,
      readAttribute: async () => ({ event: "page" }),
    };

    await findUsagePlugin.handler({
      projectConfig,
      datasource,
      parsed: {
        _: ["find-usage"],
        entityType: "event",
        key: "page",
        json: true,
        pretty: true,
      },
    } as any);

    expect(log).toHaveBeenCalledWith(
      '[\n  {\n    "entityType": "attribute",\n    "key": "userId"\n  }\n]',
    );
  });

  it("does not report partial string matches as usages", async () => {
    const empty = async () => [];
    const datasource = {
      listEvents: empty,
      listAttributes: async () => ["userIdLong"],
      listDestinations: empty,
      listEffects: empty,
      listSchemas: empty,
      listTargets: empty,
      listTests: empty,
      readAttribute: async () => ({ source: "userIdLong" }),
    };

    await findUsagePlugin.handler({
      projectConfig,
      datasource,
      parsed: { _: ["find-usage"], entityType: "attribute", key: "userId", json: true },
    } as any);

    expect(log).toHaveBeenLastCalledWith("[]");
  });

  it("reports invalid list key patterns clearly", async () => {
    await expect(
      listPlugin.handler({
        projectConfig,
        datasource: { listEvents: async () => ["page"] },
        parsed: { _: ["list"], entityType: "event", keyPattern: "[" },
      } as any),
    ).rejects.toThrow('Invalid key pattern "[".');
  });
});
