import * as z from "zod";

export const JSONZodSchema = getJSONSchema();

/**
 * Creates a Zod schema for a JSON Schema object based on the JSON Schema specification
 */
export function getJSONSchema(): z.ZodObject<any> {
  return z
    .object({
      // Basic metadata
      description: z.string().optional(),

      // General validation keywords
      type: z
        .enum(["object", "array", "string", "number", "integer", "boolean", "null"])
        .optional(),
      enum: z.array(createValueSchema()).optional(),
      const: createValueSchema().optional(),

      // Numeric validation keywords
      maximum: z.number().optional(),
      minimum: z.number().optional(),

      // String validation keywords
      maxLength: z.number().int().min(0).optional(),
      minLength: z.number().int().min(0).optional(),
      pattern: z.string().optional(),

      // Array validation keywords
      items: z.union([createJSONSchema(), z.array(createJSONSchema())]).optional(),
      maxItems: z.number().int().min(0).optional(),
      minItems: z.number().int().min(0).optional(),
      uniqueItems: z.boolean().optional(),

      // Object validation keywords
      required: z.array(z.string()).optional(),
      properties: z.record(z.string(), createJSONSchema()).optional(),

      // Annotations
      default: createValueSchema().optional(),
      examples: z.array(createValueSchema()).optional(),

      // project specific additional properties
      defaultSource: z.string().optional(),
      defaultSources: z.array(z.string()).optional(),
    })
    .refine((schema) => validateSchemaConstraints(schema), {
      message: "Schema validation failed: schema does not conform to JSON Schema specification",
      path: ["schema"],
    })
    .strict();
}

/**
 * Creates a Zod schema for JSON Schema values
 */
function createValueSchema(): z.ZodType<any> {
  return z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.undefined(),
    z.lazy(() => z.record(z.string(), createValueSchema())),
    z.lazy(() => z.array(createValueSchema())),
  ]);
}

/**
 * Creates a Zod schema for JSON Schema objects
 */
function createJSONSchema(): z.ZodType<any> {
  return z.lazy(() => getJSONSchema());
}

/**
 * Main validation function that validates a JSON Schema definition
 */
export function validateJSONSchema(schema: any): JSONSchemaValidationResult {
  if (schema === null || typeof schema !== "object") {
    return {
      valid: false,
      errors: [
        {
          code: "INVALID_SCHEMA_TYPE",
          message: "Schema must be an object",
          path: [],
        },
      ],
    };
  }

  const errors: JSONSchemaValidationError[] = [];

  // Validate type constraints
  validateTypeConstraints(schema, errors);

  // Validate numeric constraints
  validateNumericConstraints(schema, errors);

  // Validate string constraints
  validateStringConstraints(schema, errors);

  // Validate array constraints
  validateArrayConstraints(schema, errors);

  // Validate object constraints
  validateObjectConstraints(schema, errors);

  return {
    valid: errors.length === 0,
    errors,
  };
}

function validateTypeConstraints(
  schema: any,
  errors: JSONSchemaValidationError[],
  path: string[] = [],
) {
  if (
    schema.type &&
    !["object", "array", "string", "number", "integer", "boolean", "null"].includes(schema.type)
  ) {
    errors.push({
      path: [...path, "type"],
      message: `Invalid type: ${schema.type}. Must be one of: object, array, string, number, integer, boolean, null`,
      code: "INVALID_TYPE",
    });
  }

  // Validate enum values match declared type
  if (schema.enum && Array.isArray(schema.enum)) {
    if (schema.type === "null") {
      if (!schema.enum.includes(null)) {
        errors.push({
          path: [...path, "enum"],
          message: "Enum for null type must include null value",
          code: "INVALID_ENUM_FOR_NULL_TYPE",
        });
      }
    } else if (schema.type === "boolean") {
      if (!schema.enum.every((value: any) => value === true || value === false)) {
        errors.push({
          path: [...path, "enum"],
          message: "Enum for boolean type can only contain true or false",
          code: "INVALID_ENUM_FOR_BOOLEAN_TYPE",
        });
      }
    } else if (schema.type) {
      // Check each enum value matches the declared type
      schema.enum.forEach((value: any, index: number) => {
        if (!isValueOfType(value, schema.type)) {
          errors.push({
            path: [...path, "enum", index.toString()],
            message: `Enum value ${JSON.stringify(value)} does not match type ${schema.type}`,
            code: "TYPE_MISMATCH_IN_ENUM",
          });
        }
      });
    }
  }

  // Validate const value matches declared type
  if (schema.const !== undefined && schema.type && !isValueOfType(schema.const, schema.type)) {
    errors.push({
      path: [...path, "const"],
      message: `Const value ${JSON.stringify(schema.const)} does not match type ${schema.type}`,
      code: "TYPE_MISMATCH_IN_CONST",
    });
  }
}

/**
 * Helper function to check if a value matches a declared type
 */
function isValueOfType(value: any, declaredType: string): boolean {
  switch (declaredType) {
    case "string":
      return typeof value === "string";
    case "number":
      return typeof value === "number" && !isNaN(value);
    case "integer":
      return typeof value === "number" && Number.isInteger(value) && !isNaN(value);
    case "boolean":
      return typeof value === "boolean";
    case "null":
      return value === null;
    case "array":
      return Array.isArray(value);
    case "object":
      return typeof value === "object" && value !== null && !Array.isArray(value);
    default:
      return true;
  }
}

/**
 * Validates numeric constraints in the schema definition
 */
function validateNumericConstraints(
  schema: any,
  errors: JSONSchemaValidationError[],
  path: string[] = [],
): void {
  // Check that numeric constraints are only used with numeric types
  const numericKeywords = ["maximum", "minimum"];
  const hasNumericConstraints = numericKeywords.some((key) => schema[key] !== undefined);

  if (hasNumericConstraints && schema.type && !["number", "integer"].includes(schema.type)) {
    errors.push({
      path: [...path, "type"],
      message: "Numeric constraints can only be used with number or integer types",
      code: "NUMERIC_CONSTRAINTS_ON_NON_NUMERIC_TYPE",
    });
  }

  // Validate maximum
  if (schema.maximum !== undefined) {
    if (typeof schema.maximum !== "number" || isNaN(schema.maximum)) {
      errors.push({
        path: [...path, "maximum"],
        message: "maximum must be a valid number",
        code: "INVALID_MAXIMUM",
      });
    }
  }

  // Validate minimum
  if (schema.minimum !== undefined) {
    if (typeof schema.minimum !== "number" || isNaN(schema.minimum)) {
      errors.push({
        path: [...path, "minimum"],
        message: "minimum must be a valid number",
        code: "INVALID_MINIMUM",
      });
    }
  }

  // Check for logical inconsistencies
  if (schema.maximum !== undefined && schema.minimum !== undefined) {
    if (schema.maximum < schema.minimum) {
      errors.push({
        path: [...path, "maximum"],
        message: "maximum cannot be less than minimum",
        code: "MAXIMUM_LESS_THAN_MINIMUM",
      });
    }
  }
}

/**
 * Validates string constraints in the schema definition
 */
function validateStringConstraints(
  schema: any,
  errors: JSONSchemaValidationError[],
  path: string[] = [],
): void {
  // Check that string constraints are only used with string types
  const stringKeywords = ["maxLength", "minLength", "pattern", "format"];
  const hasStringConstraints = stringKeywords.some((key) => schema[key] !== undefined);

  if (hasStringConstraints && schema.type && schema.type !== "string") {
    errors.push({
      path: [...path, "type"],
      message: "String constraints can only be used with string type",
      code: "STRING_CONSTRAINTS_ON_NON_STRING_TYPE",
    });
  }

  // Validate maxLength/minLength
  if (schema.maxLength !== undefined) {
    if (
      typeof schema.maxLength !== "number" ||
      !Number.isInteger(schema.maxLength) ||
      schema.maxLength < 0
    ) {
      errors.push({
        path: [...path, "maxLength"],
        message: "maxLength must be a non-negative integer",
        code: "INVALID_MAX_LENGTH",
      });
    }
  }

  if (schema.minLength !== undefined) {
    if (
      typeof schema.minLength !== "number" ||
      !Number.isInteger(schema.minLength) ||
      schema.minLength < 0
    ) {
      errors.push({
        path: [...path, "minLength"],
        message: "minLength must be a non-negative integer",
        code: "INVALID_MIN_LENGTH",
      });
    }
  }

  // Check for logical inconsistencies
  if (schema.maxLength !== undefined && schema.minLength !== undefined) {
    if (schema.maxLength < schema.minLength) {
      errors.push({
        path: [...path, "maxLength"],
        message: "maxLength cannot be less than minLength",
        code: "MAX_LENGTH_LESS_THAN_MIN_LENGTH",
      });
    }
  }

  // Validate pattern
  if (schema.pattern !== undefined) {
    if (typeof schema.pattern !== "string") {
      errors.push({
        path: [...path, "pattern"],
        message: "pattern must be a string",
        code: "INVALID_PATTERN_TYPE",
      });
    } else {
      try {
        new RegExp(schema.pattern);
        // eslint-disable-next-line
      } catch (e) {
        errors.push({
          path: [...path, "pattern"],
          message: `Invalid regex pattern: ${schema.pattern}`,
          code: "INVALID_REGEX_PATTERN",
        });
      }
    }
  }
}

/**
 * Validates array constraints in the schema definition
 */
function validateArrayConstraints(
  schema: any,
  errors: JSONSchemaValidationError[],
  path: string[] = [],
): void {
  // Check that array constraints are only used with array types
  const arrayKeywords = ["items", "maxItems", "minItems", "uniqueItems"];
  const hasArrayConstraints = arrayKeywords.some((key) => schema[key] !== undefined);

  if (hasArrayConstraints && schema.type && schema.type !== "array") {
    errors.push({
      path: [...path, "type"],
      message: "Array constraints can only be used with array type",
      code: "ARRAY_CONSTRAINTS_ON_NON_ARRAY_TYPE",
    });
  }

  // Validate maxItems/minItems
  if (schema.maxItems !== undefined) {
    if (!Number.isInteger(schema.maxItems) || schema.maxItems < 0) {
      errors.push({
        path: [...path, "maxItems"],
        message: "maxItems must be a non-negative integer",
        code: "INVALID_MAX_ITEMS",
      });
    }
  }

  if (schema.minItems !== undefined) {
    if (!Number.isInteger(schema.minItems) || schema.minItems < 0) {
      errors.push({
        path: [...path, "minItems"],
        message: "minItems must be a non-negative integer",
        code: "INVALID_MIN_ITEMS",
      });
    }
  }

  // Check for logical inconsistencies
  if (schema.maxItems !== undefined && schema.minItems !== undefined) {
    if (schema.maxItems < schema.minItems) {
      errors.push({
        path: [...path, "maxItems"],
        message: "maxItems cannot be less than minItems",
        code: "MAX_ITEMS_LESS_THAN_MIN_ITEMS",
      });
    }
  }

  // Validate uniqueItems
  if (schema.uniqueItems !== undefined && typeof schema.uniqueItems !== "boolean") {
    errors.push({
      path: [...path, "uniqueItems"],
      message: "uniqueItems must be a boolean",
      code: "INVALID_UNIQUE_ITEMS",
    });
  }

  // Validate items
  if (schema.items !== undefined) {
    if (Array.isArray(schema.items)) {
      // Array of schemas - validate each item
      schema.items.forEach((item: any, index: number) => {
        if (typeof item !== "object" || item === null) {
          errors.push({
            path: [...path, "items", index.toString()],
            message: "Array items must be schema objects",
            code: "INVALID_ITEMS_SCHEMA",
          });
        } else {
          // Recursively validate the item schema
          const itemResult = validateJSONSchema(item);
          errors.push(
            ...itemResult.errors.map((error) => ({
              ...error,
              path: [...path, "items", index.toString(), ...error.path],
            })),
          );
        }
      });
    } else if (typeof schema.items !== "object" || schema.items === null) {
      errors.push({
        path: [...path, "items"],
        message: "items must be a schema object or array of schemas",
        code: "INVALID_ITEMS_TYPE",
      });
    } else {
      // Single schema - recursively validate
      const itemsResult = validateJSONSchema(schema.items);
      errors.push(
        ...itemsResult.errors.map((error) => ({
          ...error,
          path: [...path, "items", ...error.path],
        })),
      );
    }
  }
}

/**
 * Validates object constraints in the schema definition
 */
function validateObjectConstraints(
  schema: any,
  errors: JSONSchemaValidationError[],
  path: string[] = [],
): void {
  // Check that object constraints are only used with object types
  const objectKeywords = ["required", "properties"];
  const hasObjectConstraints = objectKeywords.some((key) => schema[key] !== undefined);

  if (hasObjectConstraints && schema.type && schema.type !== "object") {
    errors.push({
      path: [...path, "type"],
      message: "Object constraints can only be used with object type",
      code: "OBJECT_CONSTRAINTS_ON_NON_OBJECT_TYPE",
    });
  }

  // Validate required
  if (schema.required !== undefined) {
    if (!Array.isArray(schema.required)) {
      errors.push({
        path: [...path, "required"],
        message: "required must be an array",
        code: "INVALID_REQUIRED_TYPE",
      });
    } else {
      schema.required.forEach((item: any, index: number) => {
        if (typeof item !== "string") {
          errors.push({
            path: [...path, "required", index.toString()],
            message: "Required items must be strings",
            code: "INVALID_REQUIRED_ITEM",
          });
        }
      });
    }
  }

  // Validate properties
  if (schema.properties !== undefined) {
    if (typeof schema.properties !== "object" || schema.properties === null) {
      errors.push({
        path: [...path, "properties"],
        message: "properties must be an object",
        code: "INVALID_PROPERTIES_TYPE",
      });
    } else {
      Object.entries(schema.properties).forEach(([key, value]) => {
        if (typeof value !== "object" || value === null) {
          errors.push({
            path: [...path, "properties", key],
            message: "Property values must be schema objects",
            code: "INVALID_PROPERTY_SCHEMA",
          });
        } else {
          // Recursively validate the property schema
          const propertyResult = validateJSONSchema(value);
          errors.push(
            ...propertyResult.errors.map((error) => ({
              ...error,
              path: [...path, "properties", key, ...error.path],
            })),
          );
        }
      });
    }
  }
}

/**
 * Validates all schema constraints
 */
function validateSchemaConstraints(schema: any): boolean {
  const result = validateJSONSchema(schema);
  return result.valid;
}

/**
 * Validation result interface
 */
export interface JSONSchemaValidationResult {
  valid: boolean;
  errors: JSONSchemaValidationError[];
}

/**
 * Validation error interface
 */
export interface JSONSchemaValidationError {
  path: (string | number)[];
  message: string;
  code: string;
}
