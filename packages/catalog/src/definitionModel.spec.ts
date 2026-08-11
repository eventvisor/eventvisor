import {
  flattenDefinition,
  flattenValue,
  getBehaviorDefinition,
  getDetailTabs,
  hasStructuredSchema,
  getSchemaPresentation,
  getSchemaRows,
  getTargetSelectionDefinition,
} from "./definitionModel";

describe("definitionModel", () => {
  it("builds readable schema paths and resolves required fields at each level", () => {
    const rows = getSchemaRows({
      type: "object",
      required: ["user"],
      properties: {
        user: {
          type: "object",
          required: ["address"],
          properties: {
            name: { type: "string" },
            address: {
              type: "object",
              properties: {
                city: { type: "string", minLength: 2, description: "City name" },
              },
            },
          },
        },
      },
    });

    expect(rows.map(({ path, type, required }) => ({ path, type, required }))).toEqual([
      { path: "$", type: "object", required: undefined },
      { path: "user", type: "object", required: true },
      { path: "user.name", type: "string", required: false },
      { path: "user.address", type: "object", required: true },
      { path: "user.address.city", type: "string", required: false },
    ]);
    expect(rows[4]).toMatchObject({
      description: "City name",
      constraints: [{ label: "min length", value: 2 }],
    });
  });

  it("represents homogeneous and tuple array item paths", () => {
    expect(
      getSchemaRows({
        type: "array",
        items: { type: "object", properties: { id: { type: "string" } } },
      }).map((row) => row.path),
    ).toEqual(["$", "$[]", "$[].id"]);
    expect(
      getSchemaRows({ type: "array", items: [{ type: "string" }, { type: "number" }] }).map(
        (row) => row.path,
      ),
    ).toEqual(["$", "$[0]", "$[1]"]);
  });

  it("presents the root schema separately from its structure", () => {
    expect(
      getSchemaPresentation({
        type: "object",
        properties: {
          user: {
            type: "object",
            properties: { id: { type: "string" } },
          },
        },
      }),
    ).toMatchObject({
      root: { path: "$", type: "object" },
      rows: [
        { path: "user", type: "object" },
        { path: "user.id", type: "string" },
      ],
    });

    expect(
      getSchemaPresentation({ type: "array", items: { type: "string" } }).rows.map(
        (row) => row.path,
      ),
    ).toEqual(["[]"]);
  });

  it("infers useful types when type is omitted", () => {
    expect(getSchemaRows({ properties: {} })[0].type).toBe("object");
    expect(getSchemaRows({ items: {} })[0].type).toBe("array");
    expect(getSchemaRows({ enum: ["one", 2, null] })[0].type).toBe("string | number | null");
    expect(getSchemaRows({})[0].type).toBe("any");
    expect(getSchemaRows({ schema: "customer" })[0]).toMatchObject({
      type: "schema:customer",
      schemaKey: "customer",
    });
  });

  it("shows schema structure only for object and array entities", () => {
    expect(hasStructuredSchema({ type: "object" })).toBe(true);
    expect(hasStructuredSchema({ properties: { id: { type: "string" } } })).toBe(true);
    expect(hasStructuredSchema({ type: "array" })).toBe(true);
    expect(hasStructuredSchema({ items: { type: "string" } })).toBe(true);
    expect(hasStructuredSchema({ type: "string" })).toBe(false);
    expect(hasStructuredSchema({ schema: "customer" })).toBe(false);
  });

  it("flattens configuration objects while keeping compact primitive arrays", () => {
    expect(
      flattenDefinition({
        tags: ["web", "checkout"],
        conditions: { and: [{ attribute: "country", operator: "equals", value: "NL" }] },
        transforms: [],
        metadata: {},
        nullable: null,
      }),
    ).toEqual([
      { path: "tags", value: ["web", "checkout"] },
      { path: "conditions.and[0].attribute", value: "country" },
      { path: "conditions.and[0].operator", value: "equals" },
      { path: "conditions.and[0].value", value: "NL" },
      { path: "transforms", value: [] },
      { path: "metadata", value: {} },
      { path: "nullable", value: null },
    ]);
    expect(flattenDefinition({})).toEqual([]);
  });

  it("flattens structural values without repeating their section name", () => {
    expect(flattenValue([{ type: "trim", target: "coupon" }])).toEqual([
      { path: "[0].type", value: "trim" },
      { path: "[0].target", value: "coupon" },
    ]);
    expect(flattenValue("localstorage")).toEqual([{ path: "$", value: "localstorage" }]);
  });

  it("builds concise tabs from the structures that an event actually defines", () => {
    expect(
      getDetailTabs("event", {
        type: "object",
        conditions: [{ attribute: "country", operator: "equals", value: "NL" }],
        transforms: [{ type: "trim" }],
        destinations: { analytics: true },
      }).map((tab) => tab.label),
    ).toEqual(["Overview", "Behavior", "Transforms", "Destinations", "Tests", "Usage", "History"]);
  });

  it("does not add empty structural tabs", () => {
    expect(
      getDetailTabs("attribute", {
        type: "string",
        transforms: [],
        targets: [],
      }).map((tab) => tab.label),
    ).toEqual(["Overview", "Tests", "Usage", "History"]);

    expect(
      getDetailTabs("event", {
        type: "object",
        level: "info",
        requiredAttributes: ["userId"],
      }).map((tab) => tab.label),
    ).toEqual(["Overview", "Tests", "Usage", "History"]);

    expect(getDetailTabs("destination", { transport: "console" }).map((tab) => tab.label)).toEqual([
      "Overview",
      "Tests",
      "Usage",
      "History",
    ]);
  });

  it("gives effects separate behavior and steps tabs", () => {
    expect(
      getDetailTabs("effect", {
        on: { event_tracked: ["checkout"] },
        steps: [{ handler: "pixel" }],
      }).map((tab) => tab.label),
    ).toEqual(["Overview", "Behavior", "Steps", "Tests", "Usage", "History"]);
  });

  it("keeps target selection and output concerns separate", () => {
    const entity = {
      description: "Web",
      tag: "web",
      includeEvents: ["checkout_*"],
      excludeEvents: ["checkout_internal"],
      pretty: true,
      revisionFromHash: false,
    };
    expect(getDetailTabs("target", entity).map((tab) => tab.label)).toEqual([
      "Overview",
      "Selection",
      "Tests",
      "Usage",
      "History",
    ]);
    expect(getTargetSelectionDefinition(entity)).toEqual({
      filters: {
        tag: "web",
        includeEvents: ["checkout_*"],
        excludeEvents: ["checkout_internal"],
      },
      output: { pretty: true, revisionFromHash: false },
    });
  });

  it("keeps runtime behavior out of schema and structural tabs", () => {
    expect(
      getBehaviorDefinition("event", {
        schema: "checkout",
        type: "object",
        properties: { orderId: { type: "string" } },
        level: "info",
        requiredAttributes: ["userId"],
        conditions: [{ attribute: "country", operator: "equals", value: "NL" }],
        sample: { by: "userId", percentage: 10 },
        transforms: [{ type: "trim" }],
        destinations: { analytics: true },
      }),
    ).toEqual({
      conditions: [{ attribute: "country", operator: "equals", value: "NL" }],
      sample: { by: "userId", percentage: 10 },
    });
  });
});
