import { getSemanticIssues, type LintContext } from "./semanticValidation";

describe("semantic lint validation", () => {
  function createContext(): LintContext {
    return {
      attributes: {
        userId: {
          description: "User ID",
          tags: ["web"],
          type: "string",
        },
      },
      events: {
        page_view: {
          description: "Page view",
          tags: ["web"],
          type: "object",
          properties: {
            url: { type: "string" },
          },
          required: ["url"],
        },
      },
      destinations: {
        console: {
          description: "Console",
          tags: ["web"],
          transport: "console",
        },
      },
      effects: {
        sync_user: {
          description: "Sync user",
          tags: ["web"],
          on: {
            event_tracked: ["page_view"],
          },
          state: {
            synced: false,
          },
        },
      },
    };
  }

  it("reports missing cross-entity references", () => {
    const issues = getSemanticIssues(
      "event",
      {
        description: "Broken event",
        tags: ["web"],
        type: "object",
        requiredAttributes: ["missingAttribute"],
        destinations: {
          missingDestination: true,
        },
      },
      createContext(),
    );

    expect(issues.map((issue) => issue.message)).toEqual(
      expect.arrayContaining([
        'requiredAttributes references missing attribute "missingAttribute"',
        'destinations references missing destination "missingDestination"',
      ]),
    );
  });

  it("reports invalid payload paths and unsupported source arrays", () => {
    const issues = getSemanticIssues(
      "attribute",
      {
        description: "Broken attribute",
        tags: ["web"],
        type: "object",
        properties: {
          userId: { type: "string" },
        },
        transforms: [
          {
            type: "trim",
            target: "userId",
            payload: "unknownField",
          },
          {
            type: "set",
            source: ["payload.userId"],
            target: "copy",
          },
        ],
      },
      createContext(),
    );

    expect(issues.map((issue) => issue.message)).toEqual(
      expect.arrayContaining([
        'Payload reference "unknownField" references payload path "unknownField" that is not defined in the referenced schema',
        'The "source" field does not support arrays; use "payload" for multi-source payload references',
      ]),
    );
  });

  it("reports invalid transform targets against declared schema paths", () => {
    const issues = getSemanticIssues(
      "event",
      {
        description: "Banner click",
        tags: ["web"],
        type: "object",
        properties: {
          screen: {
            type: "object",
            properties: {
              width: {
                type: "number",
              },
            },
          },
        },
        transforms: [
          {
            type: "set",
            lookup: "browser.screen.width",
            target: "screen.width123",
          },
        ],
      },
      createContext(),
    );

    expect(issues.map((issue) => issue.message)).toContain(
      'Transform target "screen.width123" references payload path "screen.width123" that is not defined in the referenced schema',
    );
  });

  it("reports invalid source origins for effect transforms and missing trigger references", () => {
    const issues = getSemanticIssues(
      "effect",
      {
        description: "Broken effect",
        tags: ["web"],
        on: {
          event_tracked: ["missing_event"],
        },
        state: {
          synced: false,
        },
        steps: [
          {
            transforms: [
              {
                type: "set",
                source: "payload.url",
                target: "synced",
              },
            ],
          },
        ],
      },
      createContext(),
    );

    expect(issues.map((issue) => issue.message)).toEqual(
      expect.arrayContaining([
        'Effect trigger references missing event "missing_event"',
        'Source origin "payload" is not available in this context',
      ]),
    );
  });

  it("reports invalid references inside test specs", () => {
    const issues = getSemanticIssues(
      "test",
      {
        event: "missing_event",
        assertions: [
          {
            expectedDestinations: ["missing_destination"],
            actions: [
              {
                type: "track",
                name: "missing_event",
              },
              {
                type: "setAttribute",
                name: "missing_attribute",
              },
            ],
          },
        ],
      },
      createContext(),
    );

    expect(issues.map((issue) => issue.message)).toEqual(
      expect.arrayContaining([
        'Test references missing event "missing_event"',
        'expectedDestinations references missing destination "missing_destination"',
        'Action references missing event "missing_event"',
        'Action references missing attribute "missing_attribute"',
      ]),
    );
  });

  it("allows runtime map sources and transport-name expected destinations", () => {
    const attributeSourceIssues = getSemanticIssues(
      "destination",
      {
        description: "Console",
        tags: ["web"],
        transport: "console",
        transforms: [
          {
            type: "set",
            source: "attributes",
            target: "attributes",
          },
        ],
      },
      createContext(),
    );

    const expectedDestinationIssues = getSemanticIssues(
      "test",
      {
        event: "page_view",
        assertions: [
          {
            expectedDestinations: ["console"],
          },
        ],
      },
      createContext(),
    );

    expect(attributeSourceIssues).toHaveLength(0);
    expect(expectedDestinationIssues).toHaveLength(0);
  });
});
