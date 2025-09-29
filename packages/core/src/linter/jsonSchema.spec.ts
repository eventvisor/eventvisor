import { validateJSONSchema } from "./jsonSchema";

describe("JSON Schema Validator", () => {
  describe("Basic Schema Structure", () => {
    it("should validate a valid empty schema", () => {
      const schema = {};
      const result = validateJSONSchema(schema);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should reject non-object schemas", () => {
      const schema = "not an object";
      const result = validateJSONSchema(schema);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe("INVALID_SCHEMA_TYPE");
    });

    it("should reject null schemas", () => {
      const schema = null;
      const result = validateJSONSchema(schema);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe("INVALID_SCHEMA_TYPE");
    });
  });

  describe("Type Constraints", () => {
    it("should validate valid types", () => {
      const validTypes = ["object", "array", "string", "number", "integer", "boolean", "null"];

      for (const type of validTypes) {
        const schema = { type };
        const result = validateJSONSchema(schema);
        expect(result.valid).toBe(true);
      }
    });

    it("should reject invalid types", () => {
      const schema = { type: "invalid_type" };
      const result = validateJSONSchema(schema);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe("INVALID_TYPE");
    });

    it("should validate enum values match declared type", () => {
      const schema = {
        type: "string",
        enum: ["valid", "also_valid", 123], // 123 doesn't match string type
      };
      const result = validateJSONSchema(schema);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe("TYPE_MISMATCH_IN_ENUM");
      expect(result.errors[0].path).toEqual(["enum", "2"]);
    });

    it("should validate const value matches declared type", () => {
      const schema = {
        type: "number",
        const: "not a number",
      };
      const result = validateJSONSchema(schema);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe("TYPE_MISMATCH_IN_CONST");
    });

    it("should validate null type enum includes null", () => {
      const schema = {
        type: "null",
        enum: ["not null"],
      };
      const result = validateJSONSchema(schema);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe("INVALID_ENUM_FOR_NULL_TYPE");
    });

    it("should validate boolean type enum only contains boolean values", () => {
      const schema = {
        type: "boolean",
        enum: [true, false, "not boolean"],
      };
      const result = validateJSONSchema(schema);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe("INVALID_ENUM_FOR_BOOLEAN_TYPE");
    });
  });

  describe("Numeric Constraints", () => {
    it("should validate numeric constraints only on numeric types", () => {
      const schema = {
        type: "string",
        maximum: 10,
      };
      const result = validateJSONSchema(schema);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe("NUMERIC_CONSTRAINTS_ON_NON_NUMERIC_TYPE");
    });

    it("should validate maximum is a valid number", () => {
      const schema = {
        type: "number",
        maximum: "not a number",
      };
      const result = validateJSONSchema(schema);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe("INVALID_MAXIMUM");
    });

    it("should validate minimum is a valid number", () => {
      const schema = {
        type: "number",
        minimum: "not a number",
      };
      const result = validateJSONSchema(schema);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe("INVALID_MINIMUM");
    });

    it("should validate maximum >= minimum", () => {
      const schema = {
        type: "number",
        maximum: 5,
        minimum: 10,
      };
      const result = validateJSONSchema(schema);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe("MAXIMUM_LESS_THAN_MINIMUM");
    });

    it("should accept valid numeric constraints", () => {
      const schema = {
        type: "number",
        maximum: 100,
        minimum: 0,
      };
      const result = validateJSONSchema(schema);
      expect(result.valid).toBe(true);
    });

    it("should handle edge cases with null and undefined values", () => {
      // Schema with explicit null values
      const schemaWithNull = {
        type: "object",
        properties: {
          nullable: { type: "null" },
          optional: { type: "string" },
        },
      };
      expect(validateJSONSchema(schemaWithNull).valid).toBe(true);

      // Schema with undefined properties (should be rejected)
      const schemaWithUndefined: any = {
        type: "object",
        properties: {
          defined: { type: "string" },
        },
      };
      schemaWithUndefined.properties.undefined = undefined;

      // The validator should reject schemas with undefined property values
      const result = validateJSONSchema(schemaWithUndefined);
      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe("INVALID_PROPERTY_SCHEMA");
      expect(result.errors[0].path).toEqual(["properties", "undefined"]);
    });
  });

  describe("String Constraints", () => {
    it("should validate string constraints only on string types", () => {
      const schema = {
        type: "number",
        maxLength: 10,
      };
      const result = validateJSONSchema(schema);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe("STRING_CONSTRAINTS_ON_NON_STRING_TYPE");
    });

    it("should validate maxLength is non-negative integer", () => {
      const schema = {
        type: "string",
        maxLength: -1,
      };
      const result = validateJSONSchema(schema);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe("INVALID_MAX_LENGTH");
    });

    it("should validate minLength is non-negative integer", () => {
      const schema = {
        type: "string",
        minLength: 3.5,
      };
      const result = validateJSONSchema(schema);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe("INVALID_MIN_LENGTH");
    });

    it("should validate maxLength >= minLength", () => {
      const schema = {
        type: "string",
        maxLength: 5,
        minLength: 10,
      };
      const result = validateJSONSchema(schema);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe("MAX_LENGTH_LESS_THAN_MIN_LENGTH");
    });

    it("should validate pattern is a string", () => {
      const schema = {
        type: "string",
        pattern: 123,
      };
      const result = validateJSONSchema(schema);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe("INVALID_PATTERN_TYPE");
    });

    it("should validate pattern is a valid regex", () => {
      const schema = {
        type: "string",
        pattern: "[invalid regex",
      };
      const result = validateJSONSchema(schema);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe("INVALID_REGEX_PATTERN");
    });

    it("should accept valid string constraints", () => {
      const schema = {
        type: "string",
        maxLength: 100,
        minLength: 1,
        pattern: "^[a-z]+$",
      };
      const result = validateJSONSchema(schema);
      expect(result.valid).toBe(true);
    });
  });

  describe("Array Constraints", () => {
    it("should validate array constraints only on array types", () => {
      const schema = {
        type: "string",
        maxItems: 10,
      };
      const result = validateJSONSchema(schema);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe("ARRAY_CONSTRAINTS_ON_NON_ARRAY_TYPE");
    });

    it("should validate maxItems is non-negative integer", () => {
      const schema = {
        type: "array",
        maxItems: -1,
      };
      const result = validateJSONSchema(schema);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe("INVALID_MAX_ITEMS");
    });

    it("should validate minItems is non-negative integer", () => {
      const schema = {
        type: "array",
        minItems: 3.5,
      };
      const result = validateJSONSchema(schema);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe("INVALID_MIN_ITEMS");
    });

    it("should validate maxItems >= minItems", () => {
      const schema = {
        type: "array",
        maxItems: 5,
        minItems: 10,
      };
      const result = validateJSONSchema(schema);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe("MAX_ITEMS_LESS_THAN_MIN_ITEMS");
    });

    it("should validate uniqueItems is boolean", () => {
      const schema = {
        type: "array",
        uniqueItems: "not boolean",
      };
      const result = validateJSONSchema(schema);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe("INVALID_UNIQUE_ITEMS");
    });

    it("should validate items array contains valid schemas", () => {
      const schema = {
        type: "array",
        items: [{ type: "string" }, "not a schema"],
      };
      const result = validateJSONSchema(schema);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe("INVALID_ITEMS_SCHEMA");
    });

    it("should validate items is a valid schema", () => {
      const schema = {
        type: "array",
        items: "not a schema",
      };
      const result = validateJSONSchema(schema);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe("INVALID_ITEMS_TYPE");
    });

    it("should accept valid array constraints", () => {
      const schema = {
        type: "array",
        maxItems: 100,
        minItems: 1,
        uniqueItems: true,
        items: { type: "string" },
      };
      const result = validateJSONSchema(schema);
      expect(result.valid).toBe(true);
    });
  });

  describe("Object Constraints", () => {
    it("should validate object constraints only on object types", () => {
      const schema = {
        type: "string",
        properties: { name: { type: "string" } },
      };
      const result = validateJSONSchema(schema);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe("OBJECT_CONSTRAINTS_ON_NON_OBJECT_TYPE");
    });

    it("should validate required is an array", () => {
      const schema = {
        type: "object",
        required: "not an array",
      };
      const result = validateJSONSchema(schema);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe("INVALID_REQUIRED_TYPE");
    });

    it("should validate required array contains strings", () => {
      const schema = {
        type: "object",
        required: ["prop1", 123, "prop3"],
      };
      const result = validateJSONSchema(schema);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe("INVALID_REQUIRED_ITEM");
    });

    it("should validate properties is an object", () => {
      const schema = {
        type: "object",
        properties: "not an object",
      };
      const result = validateJSONSchema(schema);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe("INVALID_PROPERTIES_TYPE");
    });

    it("should validate properties values are schemas", () => {
      const schema = {
        type: "object",
        properties: {
          prop1: { type: "string" },
          prop2: "not a schema",
        },
      };
      const result = validateJSONSchema(schema);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe("INVALID_PROPERTY_SCHEMA");
    });

    it("should accept valid object constraints", () => {
      const schema = {
        type: "object",
        required: ["prop1"],
        properties: {
          prop1: { type: "string" },
        },
      };
      const result = validateJSONSchema(schema);
      expect(result.valid).toBe(true);
    });
  });

  describe("Complex Schema Validation", () => {
    it("should validate a complex valid schema", () => {
      const schema = {
        description: "A schema for user data",
        type: "object",
        properties: {
          id: {
            type: "integer",
            minimum: 1,
          },
          name: {
            type: "string",
            minLength: 1,
            maxLength: 100,
          },
          email: {
            type: "string",
          },
          age: {
            type: "integer",
            minimum: 0,
            maximum: 150,
          },
          tags: {
            type: "array",
            items: { type: "string" },
            uniqueItems: true,
          },
        },
        required: ["id", "name", "email"],
      };
      const result = validateJSONSchema(schema);
      expect(result.valid).toBe(true);
    });

    it("should validate nested schemas", () => {
      const schema = {
        type: "object",
        properties: {
          address: {
            type: "object",
            properties: {
              street: { type: "string" },
              city: { type: "string" },
            },
            required: ["street", "city"],
          },
        },
      };
      const result = validateJSONSchema(schema);
      expect(result.valid).toBe(true);
    });
  });

  describe("Error Paths", () => {
    it("should provide correct error paths for nested properties", () => {
      const schema = {
        type: "object",
        properties: {
          user: {
            type: "object",
            properties: {
              name: {
                type: "string",
                maxLength: "not a number", // Invalid
              },
            },
          },
        },
      };
      const result = validateJSONSchema(schema);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].path).toEqual([
        "properties",
        "user",
        "properties",
        "name",
        "maxLength",
      ]);
    });

    it("should provide correct error paths for array items", () => {
      const schema = {
        type: "array",
        items: [
          { type: "string" },
          { type: "number", maximum: "not a number" }, // Invalid
        ],
      };
      const result = validateJSONSchema(schema);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].path).toEqual(["items", "1", "maximum"]);
    });
  });

  describe("Deep Recursion and Complex Nested Schemas", () => {
    it("should handle deeply nested object schemas", () => {
      const schema = {
        type: "object",
        properties: {
          level1: {
            type: "object",
            properties: {
              level2: {
                type: "object",
                properties: {
                  level3: {
                    type: "object",
                    properties: {
                      level4: {
                        type: "object",
                        properties: {
                          level5: {
                            type: "string",
                            maxLength: 100,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      };
      const result = validateJSONSchema(schema);
      expect(result.valid).toBe(true);
    });

    it("should handle deeply nested array schemas", () => {
      const schema = {
        type: "array",
        items: {
          type: "array",
          items: {
            type: "array",
            items: {
              type: "array",
              items: {
                type: "array",
                items: { type: "string" },
              },
            },
          },
        },
      };
      const result = validateJSONSchema(schema);
      expect(result.valid).toBe(true);
    });

    it("should handle complex mixed nesting", () => {
      const schema = {
        type: "object",
        properties: {
          users: {
            type: "array",
            items: {
              type: "object",
              properties: {
                profile: {
                  type: "object",
                  properties: {
                    addresses: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          coordinates: {
                            type: "object",
                            properties: {
                              lat: { type: "number" },
                              lng: { type: "number" },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      };
      const result = validateJSONSchema(schema);
      expect(result.valid).toBe(true);
    });

    it("should detect errors in deeply nested schemas", () => {
      const schema = {
        type: "object",
        properties: {
          level1: {
            type: "object",
            properties: {
              level2: {
                type: "object",
                properties: {
                  level3: {
                    type: "string",
                    maxLength: "invalid", // Invalid
                  },
                },
              },
            },
          },
        },
      };
      const result = validateJSONSchema(schema);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].path).toEqual([
        "properties",
        "level1",
        "properties",
        "level2",
        "properties",
        "level3",
        "maxLength",
      ]);
    });
  });

  describe("Advanced Array Validation", () => {
    it("should validate complex array items with mixed schemas", () => {
      const schema = {
        type: "array",
        items: [
          { type: "string" },
          { type: "number" },
          { type: "boolean" },
          { type: "object", properties: { name: { type: "string" } } },
        ],
      };
      const result = validateJSONSchema(schema);
      expect(result.valid).toBe(true);
    });

    it("should validate uniqueItems with complex objects", () => {
      const schema = {
        type: "array",
        uniqueItems: true,
        items: {
          type: "object",
          properties: {
            id: { type: "integer" },
            name: { type: "string" },
          },
        },
      };
      const result = validateJSONSchema(schema);
      expect(result.valid).toBe(true);
    });

    it("should detect invalid array items in mixed schema", () => {
      const schema = {
        type: "array",
        items: [
          { type: "string" },
          { type: "number", maximum: "invalid" }, // Invalid
        ],
      };
      const result = validateJSONSchema(schema);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].path).toEqual(["items", "1", "maximum"]);
    });
  });

  describe("Advanced Object Validation", () => {});

  describe("Edge Cases and Error Scenarios", () => {
    it("should handle schemas with only metadata", () => {
      const schema = {
        description: "A schema with only metadata",
      };
      const result = validateJSONSchema(schema);
      expect(result.valid).toBe(true);
    });

    it("should handle schemas with only examples and default", () => {
      const schema = {
        type: "string",
        default: "default value",
        examples: ["example 1", "example 2"],
      };
      const result = validateJSONSchema(schema);
      expect(result.valid).toBe(true);
    });
  });

  describe("Performance and Large Schema Handling", () => {
    it("should handle large schemas with many properties", () => {
      const properties: Record<string, any> = {};
      for (let i = 0; i < 100; i++) {
        properties[`prop${i}`] = { type: "string" };
      }

      const schema = {
        type: "object",
        properties,
      };
      const result = validateJSONSchema(schema);
      expect(result.valid).toBe(true);
    });

    it("should handle deeply nested schemas without stack overflow", () => {
      let schema: any = { type: "string" };
      for (let i = 0; i < 50; i++) {
        schema = {
          type: "object",
          properties: {
            nested: schema,
          },
        };
      }

      const result = validateJSONSchema(schema);
      expect(result.valid).toBe(true);
    });

    it("should handle schemas with many array items", () => {
      const items = Array(50)
        .fill(null)
        .map(() => ({ type: "string" }));
      const schema = {
        type: "array",
        items,
      };
      const result = validateJSONSchema(schema);
      expect(result.valid).toBe(true);
    });
  });

  describe("Additional Edge Cases and Constraint Combinations", () => {
    it("should handle schemas with all constraint types combined", () => {
      const schema = {
        type: "object",
        properties: {
          user: {
            type: "object",
            properties: {
              id: {
                type: "integer",
                minimum: 1,
                maximum: 999999,
              },
              name: {
                type: "string",
                minLength: 1,
                maxLength: 100,
                pattern: "^[a-zA-Z ]+$",
              },
              email: {
                type: "string",
              },
              age: {
                type: "integer",
                minimum: 0,
                maximum: 150,
                multipleOf: 1,
              },
              tags: {
                type: "array",
                minItems: 0,
                maxItems: 10,
                uniqueItems: true,
                items: { type: "string" },
              },
            },
            required: ["id", "name", "email"],
          },
        },
        required: ["user"],
      };
      const result = validateJSONSchema(schema);
      expect(result.valid).toBe(true);
    });

    it("should handle schemas with complex array validation combinations", () => {
      const schema = {
        type: "array",
        minItems: 1,
        maxItems: 100,
        uniqueItems: true,
        items: {
          type: "object",
          properties: {
            id: { type: "string" },
            value: { type: "number" },
          },
          required: ["id"],
        },
      };
      const result = validateJSONSchema(schema);
      expect(result.valid).toBe(true);
    });

    it("should handle schemas with complex nested structures", () => {
      const schema = {
        type: "object",
        properties: {
          user: {
            type: "object",
            properties: {
              id: { type: "string" },
              name: { type: "string" },
              role: { type: "string", const: "admin" },
              permissions: { type: "array", items: { type: "string" } },
            },
          },
          contact: {
            type: "object",
            properties: {
              email: { type: "string" },
              phone: { type: "string" },
              address: {
                type: "object",
                properties: {
                  street: { type: "string" },
                  city: { type: "string" },
                  country: { type: "string" },
                },
              },
            },
          },
        },
      };
      const result = validateJSONSchema(schema);
      expect(result.valid).toBe(true);
    });

    it("should validate complex nested schemas with all constraint types", () => {
      const schema = {
        type: "object",
        properties: {
          users: {
            type: "array",
            minItems: 1,
            maxItems: 1000,
            items: {
              type: "object",
              properties: {
                id: {
                  type: "string",
                  minLength: 1,
                  maxLength: 50,
                  pattern: "^[a-zA-Z0-9_-]+$",
                },
                profile: {
                  type: "object",
                  properties: {
                    firstName: {
                      type: "string",
                      minLength: 1,
                      maxLength: 100,
                    },
                    lastName: {
                      type: "string",
                      minLength: 1,
                      maxLength: 100,
                    },
                    birthDate: {
                      type: "string",
                    },
                    age: {
                      type: "integer",
                      minimum: 0,
                      maximum: 150,
                    },
                    height: {
                      type: "number",
                      minimum: 0.1,
                      maximum: 3.0,
                    },
                    tags: {
                      type: "array",
                      minItems: 0,
                      maxItems: 20,
                      uniqueItems: true,
                      items: {
                        type: "string",
                        minLength: 1,
                        maxLength: 50,
                      },
                    },
                  },
                  required: ["firstName", "lastName"],
                  minProperties: 2,
                  maxProperties: 6,
                },
                settings: {
                  type: "object",
                  properties: {
                    theme: { type: "string" },
                    language: { type: "string" },
                  },
                },
              },
              required: ["id"],
            },
          },
        },
        required: ["users"],
      };
      const result = validateJSONSchema(schema);
      expect(result.valid).toBe(true);
    });
  });
});
