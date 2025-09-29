import { validate } from "./validator";
import { JSONSchema } from "@eventvisor/types";

describe("Validator", () => {
  describe("Basic Type Validation", () => {
    it("should validate string type correctly", async () => {
      const schema: JSONSchema = { type: "string" };
      const result = await validate(schema, "hello", {});

      expect(result.valid).toBe(true);
      expect(result.value).toBe("hello");
      expect(result.errors).toBeUndefined();
    });

    it("should reject invalid string type", async () => {
      const schema: JSONSchema = { type: "string" };
      const result = await validate(schema, 123, {});

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors![0].message).toContain("Expected type string");
    });

    it("should validate number type correctly", async () => {
      const schema: JSONSchema = { type: "number" };
      const result = await validate(schema, 42, {});

      expect(result.valid).toBe(true);
      expect(result.value).toBe(42);
    });

    it("should validate integer type correctly", async () => {
      const schema: JSONSchema = { type: "integer" };
      const result = await validate(schema, 42, {});

      expect(result.valid).toBe(true);
      expect(result.value).toBe(42);
    });

    it("should reject non-integer for integer type", async () => {
      const schema: JSONSchema = { type: "integer" };
      const result = await validate(schema, 42.5, {});

      expect(result.valid).toBe(false);
      expect(result.errors![0].message).toContain("Number must be an integer");
    });

    it("should validate boolean type correctly", async () => {
      const schema: JSONSchema = { type: "boolean" };
      const result = await validate(schema, true, {});

      expect(result.valid).toBe(true);
      expect(result.value).toBe(true);
    });

    it("should validate null type correctly", async () => {
      const schema: JSONSchema = { type: "null" as any };
      const result = await validate(schema, null, {});

      expect(result.valid).toBe(true);
      expect(result.value).toBe(null);
    });

    it("should validate object type correctly", async () => {
      const schema: JSONSchema = { type: "object" };
      const result = await validate(schema, { key: "value" }, {});

      expect(result.valid).toBe(true);
      expect(result.value).toEqual({ key: "value" });
    });

    it("should validate array type correctly", async () => {
      const schema: JSONSchema = { type: "array" };
      const result = await validate(schema, [1, 2, 3], {});

      expect(result.valid).toBe(true);
      expect(result.value).toEqual([1, 2, 3]);
    });
  });

  describe("String Validation", () => {
    it("should validate minLength constraint", async () => {
      const schema: JSONSchema = { type: "string", minLength: 3 };
      const result = await validate(schema, "ab", {});

      expect(result.valid).toBe(false);
      expect(result.errors![0].message).toContain("at least 3 characters");
    });

    it("should validate maxLength constraint", async () => {
      const schema: JSONSchema = { type: "string", maxLength: 5 };
      const result = await validate(schema, "abcdef", {});

      expect(result.valid).toBe(false);
      expect(result.errors![0].message).toContain("at most 5 characters");
    });

    it("should validate pattern constraint", async () => {
      const schema: JSONSchema = { type: "string", pattern: "^[A-Z]+$" };
      const result = await validate(schema, "hello", {});

      expect(result.valid).toBe(false);
      expect(result.errors![0].message).toContain("match pattern");
    });

    it("should accept valid pattern", async () => {
      const schema: JSONSchema = { type: "string", pattern: "^[A-Z]+$" };
      const result = await validate(schema, "HELLO", {});

      expect(result.valid).toBe(true);
      expect(result.value).toBe("HELLO");
    });
  });

  describe("Number Validation", () => {
    it("should validate minimum constraint", async () => {
      const schema: JSONSchema = { type: "number", minimum: 10 };
      const result = await validate(schema, 5, {});

      expect(result.valid).toBe(false);
      expect(result.errors![0].message).toContain("at least 10");
    });

    it("should validate maximum constraint", async () => {
      const schema: JSONSchema = { type: "number", maximum: 100 };
      const result = await validate(schema, 150, {});

      expect(result.valid).toBe(false);
      expect(result.errors![0].message).toContain("at most 100");
    });
  });

  describe("Array Validation", () => {
    it("should validate minItems constraint", async () => {
      const schema: JSONSchema = { type: "array", minItems: 3 };
      const result = await validate(schema, [1, 2], {});

      expect(result.valid).toBe(false);
      expect(result.errors![0].message).toContain("at least 3 items");
    });

    it("should validate maxItems constraint", async () => {
      const schema: JSONSchema = { type: "array", maxItems: 2 };
      const result = await validate(schema, [1, 2, 3], {});

      expect(result.valid).toBe(false);
      expect(result.errors![0].message).toContain("at most 2 items");
    });

    it("should validate array items with single schema", async () => {
      const schema: JSONSchema = {
        type: "array",
        items: { type: "number" },
      };
      const result = await validate(schema, [1, "two", 3], {});

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors![0].path).toBe("[1]");
    });

    it("should validate array items with tuple schema", async () => {
      const schema: JSONSchema = {
        type: "array",
        items: [{ type: "string" }, { type: "number" }],
      };
      const result = await validate(schema, ["hello", 42, "extra"], {});

      expect(result.valid).toBe(true);
      expect(result.value).toEqual(["hello", 42, "extra"]);
    });
  });

  describe("Object Validation", () => {
    it("should validate required properties", async () => {
      const schema: JSONSchema = {
        type: "object",
        properties: {
          name: { type: "string" },
          age: { type: "number" },
        },
        required: ["name"],
      };
      const result = await validate(schema, { age: 25 }, {});

      expect(result.valid).toBe(false);
      expect(result.errors![0].message).toContain("Required property");
    });

    it("should validate object properties", async () => {
      const schema: JSONSchema = {
        type: "object",
        properties: {
          name: { type: "string" },
          age: { type: "number" },
        },
      };
      const result = await validate(schema, { name: "John", age: "thirty" }, {});

      expect(result.valid).toBe(false);
      expect(result.errors![0].message).toContain("Expected type number");
    });

    it("should allow additional properties by default", async () => {
      const schema: JSONSchema = {
        type: "object",
        properties: {
          name: { type: "string" },
        },
      };
      const result = await validate(schema, { name: "John", extra: "value" }, {});

      expect(result.valid).toBe(true);
      expect(result.value).toEqual({ name: "John", extra: "value" });
    });
  });

  describe("Enum and Const Validation", () => {
    it("should validate enum values", async () => {
      const schema: JSONSchema = {
        type: "string",
        enum: ["red", "green", "blue"],
      };
      const result = await validate(schema, "yellow", {});

      expect(result.valid).toBe(false);
      expect(result.errors![0].message).toContain("one of:");
    });

    it("should accept valid enum values", async () => {
      const schema: JSONSchema = {
        type: "string",
        enum: ["red", "green", "blue"],
      };
      const result = await validate(schema, "red", {});

      expect(result.valid).toBe(true);
      expect(result.value).toBe("red");
    });

    it("should validate const values", async () => {
      const schema: JSONSchema = {
        type: "string",
        const: "exact",
      };
      const result = await validate(schema, "different", {});

      expect(result.valid).toBe(false);
      expect(result.errors![0].message).toContain("exactly");
    });
  });

  describe("Default Values", () => {
    it("should apply default for missing required field", async () => {
      const schema: JSONSchema = {
        type: "object",
        properties: {
          name: { type: "string", default: "Anonymous" },
          age: { type: "number" },
        },
        required: ["name", "age"],
      };
      const result = await validate(schema, { age: 25 }, {});

      expect(result.valid).toBe(true);
      expect(result.value).toEqual({ name: "Anonymous", age: 25 });
    });

    it("should apply default for missing optional field", async () => {
      const schema: JSONSchema = {
        type: "object",
        properties: {
          name: { type: "string" },
          status: { type: "string", default: "active" },
        },
      };
      const result = await validate(schema, { name: "John" }, {});

      expect(result.valid).toBe(true);
      expect(result.value).toEqual({ name: "John", status: "active" });
    });

    it("should apply default for undefined value", async () => {
      const schema: JSONSchema = {
        type: "string",
        default: "default value",
      };
      const result = await validate(schema, undefined, {});

      expect(result.valid).toBe(true);
      expect(result.value).toBe("default value");
    });

    it("should return default when validation fails and default exists", async () => {
      const schema: JSONSchema = {
        type: "number",
        default: 42,
      };
      const result = await validate(schema, "not a number", {});

      expect(result.valid).toBe(false);
      expect(result.value).toBeUndefined();
    });
  });

  describe("Complex Nested Validation", () => {
    it("should validate deeply nested objects", async () => {
      const schema: JSONSchema = {
        type: "object",
        properties: {
          user: {
            type: "object",
            properties: {
              profile: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  age: { type: "number" },
                },
                required: ["name"],
              },
            },
            required: ["profile"],
          },
        },
      };

      const result = await validate(
        schema,
        {
          user: {
            profile: {
              name: "John",
              age: "invalid",
            },
          },
        },
        {},
      );

      expect(result.valid).toBe(false);
      expect(result.errors![0].path).toBe("user.profile.age");
    });

    it("should validate arrays of objects", async () => {
      const schema: JSONSchema = {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "number" },
            name: { type: "string" },
          },
          required: ["id"],
        },
      };

      const result = await validate(
        schema,
        [
          { id: 1, name: "John" },
          { name: "Jane" }, // missing id
          { id: 3, name: "Bob" },
        ],
        {},
      );

      expect(result.valid).toBe(false);
      expect(result.errors![0].path).toBe("[1].id");
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty objects", async () => {
      const schema: JSONSchema = { type: "object" };
      const result = await validate(schema, {}, {});

      expect(result.valid).toBe(true);
      expect(result.value).toEqual({});
    });

    it("should handle empty arrays", async () => {
      const schema: JSONSchema = { type: "array" };
      const result = await validate(schema, [], {});

      expect(result.valid).toBe(true);
      expect(result.value).toEqual([]);
    });

    it("should handle null in enum", async () => {
      const schema: JSONSchema = {
        type: "string",
        enum: ["value", null],
      };
      const result = await validate(schema, null, {});

      expect(result.valid).toBe(true);
      expect(result.value).toBe(null);
    });

    it("should handle undefined values gracefully", async () => {
      const schema: JSONSchema = { type: "string" };
      const result = await validate(schema, undefined, {});

      expect(result.valid).toBe(false);
      expect(result.errors![0].message).toContain("Required field missing");
    });
  });

  describe("Error Reporting", () => {
    it("should provide detailed error paths", async () => {
      const schema: JSONSchema = {
        type: "object",
        properties: {
          users: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
              },
            },
          },
        },
      };

      const result = await validate(
        schema,
        {
          users: [{ name: 123 }, { name: "valid" }],
        },
        {},
      );

      expect(result.valid).toBe(false);
      expect(result.errors![0].path).toBe("users[0].name");
    });

    it("should include schema and value in errors", async () => {
      const schema: JSONSchema = { type: "number" };
      const result = await validate(schema, "not a number", {});

      expect(result.errors![0].schema).toBe(schema);
      expect(result.errors![0].value).toBe("not a number");
    });
  });

  describe("JavaScript Error Object Validation", () => {
    it("should validate JavaScript Error objects with name, message, stack properties", async () => {
      const schema: JSONSchema = {
        type: "object",
        properties: {
          name: { type: "string" },
          message: { type: "string" },
          stack: { type: "string" },
          errors: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                message: { type: "string" },
              },
            },
          },
        },
        required: ["message"],
      };

      const errorObj = new Error("Test error message");
      errorObj.name = "TestError";
      errorObj.stack = "Error: Test error message\n    at test.js:1:1";

      const result = await validate(schema, errorObj as any, {});

      expect(result.valid).toBe(true);
      expect(result.value).toEqual({
        name: "TestError",
        message: "Test error message",
        stack: "Error: Test error message\n    at test.js:1:1",
      });
    });

    it("should validate Error objects with additional errors array", async () => {
      const schema: JSONSchema = {
        type: "object",
        properties: {
          name: { type: "string" },
          message: { type: "string" },
          stack: { type: "string" },
          errors: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                message: { type: "string" },
              },
            },
          },
        },
        required: ["message"],
      };

      const errorObj = {
        name: "ValidationError",
        message: "Multiple validation errors occurred",
        stack: "ValidationError: Multiple validation errors occurred",
        errors: [
          { name: "TypeError", message: "Expected string, got number" },
          { name: "ReferenceError", message: "Variable not defined" },
        ],
      };

      const result = await validate(schema, errorObj, {});

      expect(result.valid).toBe(true);
      expect(result.value).toEqual(errorObj);
    });

    it("should fail validation when required message property is missing", async () => {
      const schema: JSONSchema = {
        type: "object",
        properties: {
          name: { type: "string" },
          message: { type: "string" },
          stack: { type: "string" },
        },
        required: ["message"],
      };

      const errorObj = {
        name: "TestError",
        stack: "Error stack trace",
      };

      const result = await validate(schema, errorObj, {});

      expect(result.valid).toBe(false);
      expect(result.errors![0].message).toContain("Required property 'message' is missing");
    });

    it("should fail validation when errors array contains invalid items", async () => {
      const schema: JSONSchema = {
        type: "object",
        properties: {
          name: { type: "string" },
          message: { type: "string" },
          errors: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                message: { type: "string" },
              },
            },
          },
        },
        required: ["message"],
      };

      const errorObj = {
        name: "TestError",
        message: "Test error",
        errors: [
          { name: "ValidError", message: "Valid message" },
          { name: 123, message: "Invalid name type" }, // name should be string
        ],
      };

      const result = await validate(schema, errorObj, {});

      expect(result.valid).toBe(false);
      expect(result.errors![0].path).toBe("errors[1].name");
      expect(result.errors![0].message).toContain("Expected type string");
    });
  });
});
