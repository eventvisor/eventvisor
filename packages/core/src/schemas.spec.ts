import { collectSchemaReferences, resolveEntitySchema, resolveSchema } from "./schemas";

describe("reusable schemas", () => {
  const schemas = {
    identifier: { type: "string" as const, minLength: 1 },
    customer: {
      type: "object" as const,
      properties: { id: { schema: "identifier" } },
      required: ["id"],
    },
  };

  it("resolves root, nested, and transitive references", () => {
    expect(resolveSchema({ schema: "customer" }, schemas)).toEqual({
      type: "object",
      properties: { id: { type: "string", minLength: 1 } },
      required: ["id"],
    });
  });

  it("keeps Eventvisor entity behavior outside the resolved schema", () => {
    expect(
      resolveEntitySchema(
        {
          description: "Customer updated",
          tags: ["web"],
          schema: "customer",
          transforms: [{ type: "trim", target: "id" }],
        },
        schemas,
      ),
    ).toEqual({
      type: "object",
      properties: { id: { type: "string", minLength: 1 } },
      required: ["id"],
      description: "Customer updated",
      tags: ["web"],
      transforms: [{ type: "trim", target: "id" }],
    });
  });

  it("allows a reference to override reusable schema metadata", () => {
    expect(
      resolveSchema({ schema: "identifier", description: "Order ID", minLength: 4 }, schemas),
    ).toEqual({ type: "string", minLength: 4, description: "Order ID" });
  });

  it("reports missing and circular references", () => {
    expect(() => resolveSchema({ schema: "missing" }, schemas)).toThrow(
      'Reusable schema "missing" does not exist.',
    );
    expect(() =>
      resolveSchema({ schema: "a" }, { a: { schema: "b" }, b: { schema: "a" } }),
    ).toThrow("Circular reusable schema reference: a -> b -> a.");
  });

  it("collects direct schema dependencies", () => {
    expect(
      collectSchemaReferences({
        schema: "customer",
        properties: { fallback: { schema: "identifier" } },
        transforms: [{ value: { schema: "not-a-schema-reference" } }],
      }).sort(),
    ).toEqual(["customer", "identifier"]);
  });
});
