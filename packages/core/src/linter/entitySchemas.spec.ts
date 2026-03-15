import { getAttributeSchema } from "./attributeSchema";
import { getDestinationSchema } from "./destinationSchema";
import { getEffectSchema } from "./effectSchema";
import { getEventSchema } from "./eventSchema";
import { getConditionsSchema } from "./conditionsSchema";
import { getSampleSchema } from "./sampleSchema";
import type { Dependencies } from "../dependencies";

function createDeps(): Dependencies {
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
      tags: ["all", "web"],
      adapter: class {},
      plugins: [],
      parser: { extension: "yml", parse: jest.fn(), stringify: jest.fn() },
      prettyDatafile: false,
      stringify: true,
    },
    datasource: {} as Dependencies["datasource"],
    options: {},
  };
}

describe("entity lint schemas", () => {
  const deps = createDeps();

  it("accepts string and nested conditions including regexFlags", () => {
    const schema = getConditionsSchema(deps);

    expect(schema.safeParse("*").success).toBe(true);
    expect(
      schema.safeParse({
        and: [
          "*",
          {
            or: [
              {
                payload: "url",
                operator: "matches",
                value: "^https://",
                regexFlags: "i",
              },
            ],
          },
        ],
      }).success,
    ).toBe(true);
  });

  it("accepts arrays of samples", () => {
    const schema = getSampleSchema(deps);

    const result = schema.safeParse([
      {
        by: "userId",
        percentage: 50,
      },
      {
        by: { payload: "country" },
        range: [50, 100],
      },
    ]);

    expect(result.success).toBe(true);
  });

  it("requires attribute metadata", () => {
    const schema = getAttributeSchema(deps);

    expect(
      schema.safeParse({
        type: "string",
      }).success,
    ).toBe(false);

    expect(
      schema.safeParse({
        description: "User ID attribute",
        tags: ["web"],
        type: "string",
      }).success,
    ).toBe(true);
  });

  it("requires event metadata and keeps strict skipValidation/destination overrides", () => {
    const schema = getEventSchema(deps);

    expect(
      schema.safeParse({
        description: "Page view",
        tags: ["web"],
        type: "object",
        skipValidation: {
          conditions: "*",
        },
        destinations: {
          console: {
            sample: [
              {
                by: "userId",
                percentage: 50,
              },
            ],
          },
        },
      }).success,
    ).toBe(true);

    expect(
      schema.safeParse({
        description: "Page view",
        tags: ["web"],
        type: "object",
        skipValidation: {
          conditions: "*",
          extra: true,
        },
      }).success,
    ).toBe(false);

    expect(
      schema.safeParse({
        type: "object",
      }).success,
    ).toBe(false);
  });

  it("requires destination metadata and rejects JSON schema-only fields", () => {
    const schema = getDestinationSchema(deps);

    expect(
      schema.safeParse({
        description: "Console destination",
        tags: ["web"],
        transport: "console",
        type: "object",
      }).success,
    ).toBe(false);

    expect(
      schema.safeParse({
        description: "Console destination",
        tags: ["web"],
        transport: "console",
        sample: [
          {
            by: "userId",
            percentage: 100,
          },
        ],
      }).success,
    ).toBe(true);

    expect(
      schema.safeParse({
        transport: "console",
      }).success,
    ).toBe(false);
  });

  it("requires effect metadata and on, and rejects unknown step fields", () => {
    const schema = getEffectSchema(deps);

    expect(
      schema.safeParse({
        description: "Inject cookie banner",
        tags: ["web"],
        on: {
          event_tracked: ["page_view"],
        },
        state: {
          injected: false,
        },
      }).success,
    ).toBe(true);

    expect(
      schema.safeParse({
        description: "Inject cookie banner",
        tags: ["web"],
        on: {
          event_tracked: ["page_view"],
        },
        steps: [
          {
            handler: "pixel",
            unknown: true,
          },
        ],
      }).success,
    ).toBe(false);

    expect(
      schema.safeParse({
        description: "Inject cookie banner",
        tags: ["web"],
        steps: [],
      }).success,
    ).toBe(false);
  });
});
