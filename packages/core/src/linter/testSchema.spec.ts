import { getTestSchema } from "./testSchema";
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
      tags: ["all"],
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

describe("getTestSchema", () => {
  const schema = getTestSchema(createDeps());

  it("accepts a valid attribute test", () => {
    const result = schema.safeParse({
      attribute: "testDefaultValue",
      assertions: [
        {
          description: "attribute should be set",
          setAttribute: {
            id: "123",
            country: "NL",
          },
          withLookups: {
            "browser.screen.width": 200,
          },
          expectedToBeValid: true,
          expectedToBeSet: true,
          expectedAttribute: {
            id: "123",
            country: "NL",
          },
        },
      ],
    });

    expect(result.success).toBe(true);
  });

  it("accepts a valid event test", () => {
    const result = schema.safeParse({
      event: "page_view",
      assertions: [
        {
          description: "event should be valid",
          withLookups: {
            "browser.screen.width": 100,
          },
          track: {
            url: "https://example.com",
          },
          actions: [
            {
              type: "setAttribute",
              name: "userId",
              value: "123",
            },
            {
              type: "track",
              name: "banner_click",
              value: {
                bannerId: "123",
              },
            },
          ],
          expectedToBeValid: true,
          expectedEvent: {
            url: "https://example.com",
          },
          expectedDestinations: ["console"],
        },
      ],
    });

    expect(result.success).toBe(true);
  });

  it("accepts a valid effect test", () => {
    const result = schema.safeParse({
      effect: "inject_cookie_banner",
      assertions: [
        {
          description: "effect should be handled",
          withLookups: {
            "cookie.banner.dismissed": false,
          },
          actions: [
            {
              type: "track",
              name: "page_view",
              value: {
                url: "https://example.com",
              },
            },
          ],
          expectedState: {
            injected: true,
          },
          expectedToBeCalled: [
            {
              handler: "pixel",
              times: 1,
            },
          ],
        },
      ],
    });

    expect(result.success).toBe(true);
  });

  it("accepts a valid destination test", () => {
    const result = schema.safeParse({
      destination: "consoleSimple",
      assertions: [
        {
          description: "destination valid",
          withLookups: {
            "geo.country": "NL",
          },
          actions: [
            {
              type: "setAttribute",
              name: "userId",
              value: "123",
            },
            {
              type: "track",
              name: "page_view",
              value: {
                url: "https://example.com",
              },
            },
          ],
          expectedToBeTransported: true,
          expectedBody: {
            attributes: {
              userId: "123",
            },
          },
        },
      ],
    });

    expect(result.success).toBe(true);
  });

  it("rejects a test without a supported discriminator key", () => {
    const result = schema.safeParse({
      assertions: [],
    });

    expect(result.success).toBe(false);
  });

  it("rejects extra top-level keys", () => {
    const result = schema.safeParse({
      event: "page_view",
      assertions: [],
      archived: true,
    });

    expect(result.success).toBe(false);
  });

  it("rejects unknown assertion fields", () => {
    const result = schema.safeParse({
      attribute: "testRequired",
      assertions: [
        {
          description: "attribute should be set",
          unsupportedField: true,
        },
      ],
    });

    expect(result.success).toBe(false);
  });

  it("rejects unsupported action types", () => {
    const result = schema.safeParse({
      event: "page_view",
      assertions: [
        {
          actions: [
            {
              type: "removeAttribute",
              name: "userId",
            },
          ],
        },
      ],
    });

    expect(result.success).toBe(false);
  });

  it("rejects malformed expectedToBeCalled entries", () => {
    const result = schema.safeParse({
      effect: "inject_cookie_banner",
      assertions: [
        {
          expectedToBeCalled: [
            {
              handler: "pixel",
              times: -1,
            },
          ],
        },
      ],
    });

    expect(result.success).toBe(false);
  });

  it("rejects runtime-unsupported fields", () => {
    const unsupportedSpecs = [
      {
        event: "page_view",
        assertions: [
          {
            withAttributes: {
              userId: "123",
            },
          },
        ],
      },
      {
        destination: "consoleSimple",
        assertions: [
          {
            assertAfter: 10,
          },
        ],
      },
      {
        destination: "consoleSimple",
        assertions: [
          {
            expectedBodies: [],
          },
        ],
      },
      {
        event: "page_view",
        assertions: [
          {
            expectedDestinationsByTag: {
              marketing: ["console"],
            },
          },
        ],
      },
    ];

    for (const spec of unsupportedSpecs) {
      expect(schema.safeParse(spec).success).toBe(false);
    }
  });
});
