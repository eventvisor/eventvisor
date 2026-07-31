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
      effectsDirectoryPath: "/tmp/eventvisor/effects",
      schemasDirectoryPath: "/tmp/eventvisor/schemas",
      testsDirectoryPath: "/tmp/eventvisor/tests",
      targetsDirectoryPath: "/tmp/eventvisor/targets",
      setsDirectoryPath: "/tmp/eventvisor/sets",
      datafilesDirectoryPath: "/tmp/eventvisor/datafiles",
      systemDirectoryPath: "/tmp/eventvisor/.eventvisor",
      catalogExportDirectoryPath: "/tmp/eventvisor/out",
      datafileNamePattern: "eventvisor-%s.json",
      tags: ["all", "web"],
      sets: false,
      adapter: class {} as any,
      plugins: [],
      parser: { extension: "yml", parse: jest.fn(), stringify: jest.fn() },
      prettyDatafile: false,
      stringify: true,
      onValidationFailure: "drop",
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

  it("validates stringified conditions", () => {
    const schema = getConditionsSchema(deps);
    const condition = JSON.stringify({
      payload: "country",
      operator: "equals",
      value: "NL",
    });

    expect(schema.safeParse(condition).success).toBe(true);
    expect(schema.safeParse("not-json").success).toBe(false);
    expect(schema.safeParse("null").success).toBe(false);
    expect(schema.safeParse("[]").success).toBe(false);
    expect(schema.safeParse('{"and":[]}').success).toBe(false);
  });

  it.each([
    ["lookahead", "value(?=x)", ""],
    ["lookbehind", "(?<=x)value", ""],
    ["noncapturing group", "(?:value)", ""],
    ["named group", "(?<name>value)", ""],
    ["backreference", "(value)\\1", ""],
    ["possessive quantifier", "value++", ""],
    ["unsupported flag", "value", "u"],
    ["duplicate flag", "value", "ii"],
  ])("rejects nonportable regex %s", (_name, value, regexFlags) => {
    const schema = getConditionsSchema(deps);
    expect(
      schema.safeParse({ payload: "value", operator: "matches", value, regexFlags }).success,
    ).toBe(false);
  });

  it("accepts the portable regex subset", () => {
    const schema = getConditionsSchema(deps);
    expect(
      schema.safeParse({
        payload: "value",
        operator: "matches",
        value: "^(hello|world)[\\s\\S]+$",
        regexFlags: "gims",
      }).success,
    ).toBe(true);
  });

  it("requires portable date and semantic version operands", () => {
    const schema = getConditionsSchema(deps);
    expect(
      schema.safeParse({
        payload: "timestamp",
        operator: "after",
        value: "2026-01-01T00:00:00Z",
      }).success,
    ).toBe(true);
    expect(
      schema.safeParse({ payload: "timestamp", operator: "after", value: "2026-01-01" }).success,
    ).toBe(false);
    expect(
      schema.safeParse({ payload: "version", operator: "semverEquals", value: "1.2.3" }).success,
    ).toBe(true);
    expect(
      schema.safeParse({ payload: "version", operator: "semverEquals", value: "latest" }).success,
    ).toBe(false);
  });

  it("validates primitive membership operands", () => {
    const schema = getConditionsSchema(deps);
    expect(schema.safeParse({ payload: "value", operator: "includes", value: false }).success).toBe(
      true,
    );
    expect(
      schema.safeParse({ payload: "value", operator: "in", value: ["one", 2, true, null] }).success,
    ).toBe(true);
    expect(
      schema.safeParse({ payload: "value", operator: "includes", value: { nested: true } }).success,
    ).toBe(false);
    expect(
      schema.safeParse({ payload: "value", operator: "in", value: [{ nested: true }] }).success,
    ).toBe(false);
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
