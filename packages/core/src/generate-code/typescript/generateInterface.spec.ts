import { generateInterface } from "./generateInterface";
import { JSONSchema } from "@eventvisor/types";

describe("generateInterface", () => {
  describe("Primitive Types", () => {
    it("should generate type for string type", () => {
      const schema: JSONSchema = { type: "string" };
      const result = generateInterface(schema, "GeneratedInterface");
      expect(result).toBe("export type GeneratedInterface = string");
    });

    it("should generate type for number type", () => {
      const schema: JSONSchema = { type: "number" };
      const result = generateInterface(schema, "GeneratedInterface");
      expect(result).toBe("export type GeneratedInterface = number");
    });

    it("should generate type for integer type", () => {
      const schema: JSONSchema = { type: "integer" };
      const result = generateInterface(schema, "GeneratedInterface");
      expect(result).toBe("export type GeneratedInterface = number");
    });

    it("should generate type for boolean type", () => {
      const schema: JSONSchema = { type: "boolean" };
      const result = generateInterface(schema, "GeneratedInterface");
      expect(result).toBe("export type GeneratedInterface = boolean");
    });

    it("should generate type for null type", () => {
      const schema: JSONSchema = { type: "null" };
      const result = generateInterface(schema, "GeneratedInterface");
      expect(result).toBe("export type GeneratedInterface = null");
    });

    it("should generate type for schema without type (defaults to any)", () => {
      const schema: JSONSchema = {};
      const result = generateInterface(schema, "GeneratedInterface");
      expect(result).toBe("export type GeneratedInterface = any");
    });
  });

  describe("Objects", () => {
    it("should generate interface for simple object", () => {
      const schema: JSONSchema = {
        type: "object",
        properties: {
          name: { type: "string" },
          age: { type: "number" },
        },
      };
      const result = generateInterface(schema, "GeneratedInterface");
      expect(result).toContain("export interface GeneratedInterface");
      expect(result).toContain("name?: string;");
      expect(result).toContain("age?: number;");
    });

    it("should generate interface for object with required properties", () => {
      const schema: JSONSchema = {
        type: "object",
        properties: {
          name: { type: "string" },
          age: { type: "number" },
          email: { type: "string" },
        },
        required: ["name", "email"],
      };
      const result = generateInterface(schema, "GeneratedInterface");
      expect(result).toContain("name: string;");
      expect(result).toContain("age?: number;");
      expect(result).toContain("email: string;");
      expect(result).not.toContain("name?:");
      expect(result).not.toContain("email?:");
    });

    it("should generate interface for object with all optional properties", () => {
      const schema: JSONSchema = {
        type: "object",
        properties: {
          name: { type: "string" },
          age: { type: "number" },
        },
        required: [],
      };
      const result = generateInterface(schema, "GeneratedInterface");
      expect(result).toContain("name?: string;");
      expect(result).toContain("age?: number;");
    });

    it("should generate type for empty object", () => {
      const schema: JSONSchema = {
        type: "object",
        properties: {},
      };
      const result = generateInterface(schema, "GeneratedInterface");
      expect(result).toContain("Record<string, any>");
    });

    it("should generate type for object without properties", () => {
      const schema: JSONSchema = {
        type: "object",
      };
      const result = generateInterface(schema, "GeneratedInterface");
      expect(result).toContain("Record<string, any>");
    });

    it("should generate interface for object inferred from properties", () => {
      const schema: JSONSchema = {
        properties: {
          name: { type: "string" },
        },
      };
      const result = generateInterface(schema, "GeneratedInterface");
      expect(result).toContain("name?: string;");
    });

    it("should generate interface for object with mixed property types", () => {
      const schema: JSONSchema = {
        type: "object",
        properties: {
          name: { type: "string" },
          age: { type: "integer" },
          active: { type: "boolean" },
          score: { type: "null" },
        },
        required: ["name"],
      };
      const result = generateInterface(schema, "GeneratedInterface");
      expect(result).toContain("name: string;");
      expect(result).toContain("age?: number;");
      expect(result).toContain("active?: boolean;");
      expect(result).toContain("score?: null;");
    });
  });

  describe("Nested Objects", () => {
    it("should generate interface for nested object", () => {
      const schema: JSONSchema = {
        type: "object",
        properties: {
          user: {
            type: "object",
            properties: {
              name: { type: "string" },
              age: { type: "number" },
            },
            required: ["name"],
          },
        },
      };
      const result = generateInterface(schema, "GeneratedInterface");
      expect(result).toContain("user?: {");
      expect(result).toContain("name: string;");
      expect(result).toContain("age?: number;");
    });

    it("should generate interface for deeply nested object", () => {
      const schema: JSONSchema = {
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
                      value: { type: "string" },
                    },
                  },
                },
              },
            },
          },
        },
      };
      const result = generateInterface(schema, "GeneratedInterface");
      expect(result).toContain("level1?: {");
      expect(result).toContain("level2?: {");
      expect(result).toContain("level3?: {");
      expect(result).toContain("value?: string;");
    });

    it("should generate interface for object with multiple nested objects", () => {
      const schema: JSONSchema = {
        type: "object",
        properties: {
          address: {
            type: "object",
            properties: {
              street: { type: "string" },
              city: { type: "string" },
            },
            required: ["street"],
          },
          contact: {
            type: "object",
            properties: {
              email: { type: "string" },
              phone: { type: "string" },
            },
          },
        },
      };
      const result = generateInterface(schema, "GeneratedInterface");
      expect(result).toContain("address?: {");
      expect(result).toContain("street: string;");
      expect(result).toContain("city?: string;");
      expect(result).toContain("contact?: {");
      expect(result).toContain("email?: string;");
      expect(result).toContain("phone?: string;");
    });
  });

  describe("Arrays", () => {
    it("should generate type for array of strings", () => {
      const schema: JSONSchema = {
        type: "array",
        items: { type: "string" },
      };
      const result = generateInterface(schema, "GeneratedInterface");
      expect(result).toBe("export type GeneratedInterface = string[]");
    });

    it("should generate type for array of numbers", () => {
      const schema: JSONSchema = {
        type: "array",
        items: { type: "number" },
      };
      const result = generateInterface(schema, "GeneratedInterface");
      expect(result).toBe("export type GeneratedInterface = number[]");
    });

    it("should generate type for array of booleans", () => {
      const schema: JSONSchema = {
        type: "array",
        items: { type: "boolean" },
      };
      const result = generateInterface(schema, "GeneratedInterface");
      expect(result).toBe("export type GeneratedInterface = boolean[]");
    });

    it("should generate type for array without items", () => {
      const schema: JSONSchema = {
        type: "array",
      };
      const result = generateInterface(schema, "GeneratedInterface");
      expect(result).toBe("export type GeneratedInterface = any[]");
    });

    it("should generate type for array of objects", () => {
      const schema: JSONSchema = {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            age: { type: "number" },
          },
        },
      };
      const result = generateInterface(schema, "GeneratedInterface");
      expect(result).toContain("export type GeneratedInterface =");
      expect(result).toContain("name?: string;");
      expect(result).toContain("age?: number;");
      expect(result).toContain("[]");
    });

    it("should generate type for array of nested objects", () => {
      const schema: JSONSchema = {
        type: "array",
        items: {
          type: "object",
          properties: {
            user: {
              type: "object",
              properties: {
                name: { type: "string" },
              },
            },
          },
        },
      };
      const result = generateInterface(schema, "GeneratedInterface");
      expect(result).toContain("user?: {");
      expect(result).toContain("name?: string;");
      expect(result).toContain("[]");
    });

    it("should generate type for nested arrays", () => {
      const schema: JSONSchema = {
        type: "array",
        items: {
          type: "array",
          items: { type: "string" },
        },
      };
      const result = generateInterface(schema, "GeneratedInterface");
      expect(result).toBe("export type GeneratedInterface = string[][]");
    });

    it("should generate type for deeply nested arrays", () => {
      const schema: JSONSchema = {
        type: "array",
        items: {
          type: "array",
          items: {
            type: "array",
            items: { type: "number" },
          },
        },
      };
      const result = generateInterface(schema, "GeneratedInterface");
      expect(result).toBe("export type GeneratedInterface = number[][][]");
    });

    it("should generate type for array of arrays of objects", () => {
      const schema: JSONSchema = {
        type: "array",
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
            },
          },
        },
      };
      const result = generateInterface(schema, "GeneratedInterface");
      expect(result).toContain("id?: string;");
      expect(result).toContain("[][]");
    });
  });

  describe("Tuples", () => {
    it("should generate type for tuple type", () => {
      const schema: JSONSchema = {
        type: "array",
        items: [{ type: "string" }, { type: "number" }],
      };
      const result = generateInterface(schema, "GeneratedInterface");
      expect(result).toBe("export type GeneratedInterface = [string, number]");
    });

    it("should generate type for tuple with multiple types", () => {
      const schema: JSONSchema = {
        type: "array",
        items: [{ type: "string" }, { type: "number" }, { type: "boolean" }],
      };
      const result = generateInterface(schema, "GeneratedInterface");
      expect(result).toBe("export type GeneratedInterface = [string, number, boolean]");
    });

    it("should generate type for tuple with objects", () => {
      const schema: JSONSchema = {
        type: "array",
        items: [
          { type: "string" },
          {
            type: "object",
            properties: {
              name: { type: "string" },
            },
          },
        ],
      };
      const result = generateInterface(schema, "GeneratedInterface");
      expect(result).toContain("[string, {");
      expect(result).toContain("name?: string;");
    });

    it("should generate type for tuple with nested arrays", () => {
      const schema: JSONSchema = {
        type: "array",
        items: [
          { type: "string" },
          {
            type: "array",
            items: { type: "number" },
          },
        ],
      };
      const result = generateInterface(schema, "GeneratedInterface");
      expect(result).toBe("export type GeneratedInterface = [string, number[]]");
    });
  });

  describe("Enums", () => {
    it("should generate type for enum of strings", () => {
      const schema: JSONSchema = {
        enum: ["red", "green", "blue"],
      };
      const result = generateInterface(schema, "GeneratedInterface");
      expect(result).toBe('export type GeneratedInterface = "red" | "green" | "blue"');
    });

    it("should generate type for enum of numbers", () => {
      const schema: JSONSchema = {
        enum: [1, 2, 3],
      };
      const result = generateInterface(schema, "GeneratedInterface");
      expect(result).toBe("export type GeneratedInterface = 1 | 2 | 3");
    });

    it("should generate type for enum of booleans", () => {
      const schema: JSONSchema = {
        enum: [true, false],
      };
      const result = generateInterface(schema, "GeneratedInterface");
      expect(result).toBe("export type GeneratedInterface = true | false");
    });

    it("should generate type for enum with mixed types", () => {
      const schema: JSONSchema = {
        enum: ["string", 42, true, null],
      };
      const result = generateInterface(schema, "GeneratedInterface");
      expect(result).toContain('"string"');
      expect(result).toContain("42");
      expect(result).toContain("true");
      expect(result).toContain("null");
      expect(result).toContain(" | ");
    });

    it("should generate type for enum with single value", () => {
      const schema: JSONSchema = {
        enum: ["single"],
      };
      const result = generateInterface(schema, "GeneratedInterface");
      expect(result).toBe('export type GeneratedInterface = "single"');
    });
  });

  describe("Const Values", () => {
    it("should generate type for const string", () => {
      const schema: JSONSchema = {
        const: "fixed-value",
      };
      const result = generateInterface(schema, "GeneratedInterface");
      expect(result).toBe('export type GeneratedInterface = "fixed-value"');
    });

    it("should generate type for const number", () => {
      const schema: JSONSchema = {
        const: 42,
      };
      const result = generateInterface(schema, "GeneratedInterface");
      expect(result).toBe("export type GeneratedInterface = 42");
    });

    it("should generate type for const boolean", () => {
      const schema: JSONSchema = {
        const: true,
      };
      const result = generateInterface(schema, "GeneratedInterface");
      expect(result).toBe("export type GeneratedInterface = true");
    });

    it("should generate type for const null", () => {
      const schema: JSONSchema = {
        const: null,
      };
      const result = generateInterface(schema, "GeneratedInterface");
      expect(result).toBe("export type GeneratedInterface = null");
    });

    it("should generate type for const object", () => {
      const schema: JSONSchema = {
        const: { key: "value" },
      };
      const result = generateInterface(schema, "GeneratedInterface");
      expect(result).toContain('{"key":"value"}');
    });
  });

  describe("Complex Nested Structures", () => {
    it("should generate interface for object with array of objects", () => {
      const schema: JSONSchema = {
        type: "object",
        properties: {
          users: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                name: { type: "string" },
              },
              required: ["id"],
            },
          },
        },
      };
      const result = generateInterface(schema, "GeneratedInterface");
      expect(result).toContain("users?: {");
      expect(result).toContain("id: string;");
      expect(result).toContain("name?: string;");
      expect(result).toContain("[]");
    });

    it("should generate interface for object with nested arrays and objects", () => {
      const schema: JSONSchema = {
        type: "object",
        properties: {
          data: {
            type: "array",
            items: {
              type: "object",
              properties: {
                items: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      value: { type: "string" },
                    },
                  },
                },
              },
            },
          },
        },
      };
      const result = generateInterface(schema, "GeneratedInterface");
      expect(result).toContain("data?: {");
      expect(result).toContain("items?: {");
      expect(result).toContain("value?: string;");
      expect(result).toContain("[]");
    });

    it("should generate interface for complex user profile schema", () => {
      const schema: JSONSchema = {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          age: { type: "integer" },
          active: { type: "boolean" },
          tags: {
            type: "array",
            items: { type: "string" },
          },
          address: {
            type: "object",
            properties: {
              street: { type: "string" },
              city: { type: "string" },
              coordinates: {
                type: "object",
                properties: {
                  lat: { type: "number" },
                  lng: { type: "number" },
                },
              },
            },
            required: ["street"],
          },
          contacts: {
            type: "array",
            items: {
              type: "object",
              properties: {
                type: { type: "string" },
                value: { type: "string" },
              },
              required: ["type"],
            },
          },
        },
        required: ["id", "name"],
      };
      const result = generateInterface(schema, "GeneratedInterface");
      expect(result).toContain("id: string;");
      expect(result).toContain("name: string;");
      expect(result).toContain("age?: number;");
      expect(result).toContain("active?: boolean;");
      expect(result).toContain("tags?: string[];");
      expect(result).toContain("address?: {");
      expect(result).toContain("street: string;");
      expect(result).toContain("city?: string;");
      expect(result).toContain("coordinates?: {");
      expect(result).toContain("lat?: number;");
      expect(result).toContain("lng?: number;");
      expect(result).toContain("contacts?: {");
      expect(result).toContain("type: string;");
      expect(result).toContain("value?: string;");
    });
  });

  describe("Descriptions", () => {
    it("should include description in generated interface", () => {
      const schema: JSONSchema = {
        description: "A user schema",
        type: "object",
        properties: {
          name: { type: "string" },
        },
      };
      const result = generateInterface(schema, "GeneratedInterface");
      expect(result).toContain("/** A user schema */");
      expect(result).toContain("export interface GeneratedInterface");
    });

    it("should not include description comment when description is missing", () => {
      const schema: JSONSchema = {
        type: "object",
        properties: {
          name: { type: "string" },
        },
      };
      const result = generateInterface(schema, "GeneratedInterface");
      expect(result).not.toContain("/**");
      expect(result).toContain("export interface GeneratedInterface");
    });

    it("should include description for simple type", () => {
      const schema: JSONSchema = {
        description: "A string value",
        type: "string",
      };
      const result = generateInterface(schema, "GeneratedInterface");
      expect(result).toContain("/** A string value */");
      expect(result).toContain("export type GeneratedInterface = string");
    });
  });

  describe("Edge Cases", () => {
    it("should handle object with properties but no type specified", () => {
      const schema: JSONSchema = {
        properties: {
          name: { type: "string" },
        },
      };
      const result = generateInterface(schema, "GeneratedInterface");
      expect(result).toContain("name?: string;");
    });

    it("should handle const with higher priority than enum", () => {
      const schema: JSONSchema = {
        const: "fixed",
        enum: ["fixed", "other"],
      };
      const result = generateInterface(schema, "GeneratedInterface");
      expect(result).toBe('export type GeneratedInterface = "fixed"');
    });

    it("should handle const with higher priority than type", () => {
      const schema: JSONSchema = {
        const: "fixed",
        type: "string",
      };
      const result = generateInterface(schema, "GeneratedInterface");
      expect(result).toBe('export type GeneratedInterface = "fixed"');
    });

    it("should handle enum with higher priority than type", () => {
      const schema: JSONSchema = {
        enum: ["a", "b"],
        type: "string",
      };
      const result = generateInterface(schema, "GeneratedInterface");
      expect(result).toBe('export type GeneratedInterface = "a" | "b"');
    });

    it("should handle object with numeric property names", () => {
      const schema: JSONSchema = {
        type: "object",
        properties: {
          "0": { type: "string" },
          "1": { type: "number" },
        },
      };
      const result = generateInterface(schema, "GeneratedInterface");
      expect(result).toContain("0?: string;");
      expect(result).toContain("1?: number;");
    });

    it("should handle object with special character property names", () => {
      const schema: JSONSchema = {
        type: "object",
        properties: {
          "my-property": { type: "string" },
          "another.property": { type: "number" },
        },
      };
      const result = generateInterface(schema, "GeneratedInterface");
      expect(result).toContain("my-property?: string;");
      expect(result).toContain("another.property?: number;");
    });

    it("should handle required array with properties not in properties object", () => {
      const schema: JSONSchema = {
        type: "object",
        properties: {
          name: { type: "string" },
        },
        required: ["name", "missing"],
      };
      const result = generateInterface(schema, "GeneratedInterface");
      expect(result).toContain("name: string;");
      expect(result).not.toContain("missing");
    });

    it("should handle empty enum array", () => {
      const schema: JSONSchema = {
        enum: [],
      };
      const result = generateInterface(schema, "GeneratedInterface");
      // Should fall through to default type handling
      expect(result).toContain("export type GeneratedInterface =");
    });

    it("should handle array with empty items array", () => {
      const schema: JSONSchema = {
        type: "array",
        items: [],
      };
      const result = generateInterface(schema, "GeneratedInterface");
      // Empty array becomes empty tuple
      expect(result).toContain("[]");
    });
  });

  describe("Real-world Scenarios", () => {
    it("should generate interface for event tracking schema", () => {
      const schema: JSONSchema = {
        type: "object",
        properties: {
          eventName: { type: "string" },
          userId: { type: "string" },
          timestamp: { type: "number" },
          properties: {
            type: "object",
            properties: {
              page: { type: "string" },
              referrer: { type: "string" },
            },
          },
          tags: {
            type: "array",
            items: { type: "string" },
          },
        },
        required: ["eventName", "userId"],
      };
      const result = generateInterface(schema, "GeneratedInterface");
      expect(result).toContain("eventName: string;");
      expect(result).toContain("userId: string;");
      expect(result).toContain("timestamp?: number;");
      expect(result).toContain("properties?: {");
      expect(result).toContain("tags?: string[];");
    });

    it("should generate interface for API response schema", () => {
      const schema: JSONSchema = {
        type: "object",
        properties: {
          success: { type: "boolean" },
          data: {
            type: "object",
            properties: {
              items: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string" },
                    name: { type: "string" },
                  },
                  required: ["id"],
                },
              },
              total: { type: "integer" },
            },
          },
          errors: {
            type: "array",
            items: {
              type: "object",
              properties: {
                code: { type: "string" },
                message: { type: "string" },
              },
            },
          },
        },
        required: ["success"],
      };
      const result = generateInterface(schema, "GeneratedInterface");
      expect(result).toContain("success: boolean;");
      expect(result).toContain("data?: {");
      expect(result).toContain("items?: {");
      expect(result).toContain("id: string;");
      expect(result).toContain("total?: number;");
      expect(result).toContain("errors?: {");
    });

    it("should generate interface for configuration schema", () => {
      const schema: JSONSchema = {
        description: "Application configuration",
        type: "object",
        properties: {
          environment: {
            enum: ["development", "staging", "production"],
          },
          apiUrl: { type: "string" },
          timeout: { type: "integer" },
          features: {
            type: "object",
            properties: {
              enabled: {
                type: "array",
                items: { type: "string" },
              },
              disabled: {
                type: "array",
                items: { type: "string" },
              },
            },
          },
          retry: {
            type: "object",
            properties: {
              maxAttempts: { type: "integer" },
              backoff: { type: "number" },
            },
            required: ["maxAttempts"],
          },
        },
        required: ["environment", "apiUrl"],
      };
      const result = generateInterface(schema, "GeneratedInterface");
      expect(result).toContain("/** Application configuration */");
      expect(result).toContain('environment: "development" | "staging" | "production";');
      expect(result).toContain("apiUrl: string;");
      expect(result).toContain("timeout?: number;");
      expect(result).toContain("features?: {");
      expect(result).toContain("enabled?: string[];");
      expect(result).toContain("retry?: {");
      expect(result).toContain("maxAttempts: number;");
      expect(result).toContain("backoff?: number;");
    });
  });
});
