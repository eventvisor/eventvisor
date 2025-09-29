import { JSONSchema, Value } from "@eventvisor/types";

import type { GetSourceResolver } from "./sourceResolver";
import type { Logger } from "./logger";

export interface ValidatorOptions {
  logger: Logger;
  getSourceResolver: GetSourceResolver;
}

export class Validator {
  private logger: Logger;
  private getSourceResolver: GetSourceResolver;

  constructor(options: ValidatorOptions) {
    this.logger = options.logger;
    this.getSourceResolver = options.getSourceResolver;
  }

  validate(schema: JSONSchema, value: Value): Promise<ValidationResult> {
    const deps: ValidationDependencies = {};

    return validate(schema, value, deps);
  }
}

export interface ValidationError {
  path: string;
  message: string;
  schema?: JSONSchema;
  value?: Value;
}

export interface ValidationResult {
  valid: boolean;
  errors?: ValidationError[];
  value?: Value;
}

export interface ValidationDependencies {
  [key: string]: any;
}

export async function validate(
  schema: JSONSchema,
  value: Value,
  deps: ValidationDependencies,
): Promise<ValidationResult> {
  const errors: ValidationError[] = [];
  const result = validateValue(schema, value, "", errors, deps);

  // Only apply default if there are no validation errors and result is undefined
  if (result === undefined && errors.length === 0 && schema.default !== undefined) {
    return {
      valid: true,
      value: schema.default,
      errors: [],
    };
  }

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
    value: result,
  };
}

function validateValue(
  schema: JSONSchema,
  value: Value,
  path: string,
  errors: ValidationError[],
  deps: ValidationDependencies,
): Value | undefined {
  // Handle null values
  if (value === null) {
    if ((schema.type as any) === "null" || schema.enum?.includes(null)) {
      return value;
    }
    if (schema.type && (schema.type as any) !== "null") {
      errors.push({
        path,
        message: `Expected type ${schema.type}, got null`,
        schema,
        value,
      });
      return undefined;
    }
  }

  // Handle undefined values
  if (value === undefined) {
    if (schema.default !== undefined) {
      return schema.default;
    }
    if (schema.type) {
      errors.push({
        path,
        message: `Required field missing`,
        schema,
        value,
      });
      return undefined;
    }
    return undefined;
  }

  // Type validation (but allow number for integer type to handle specific validation)
  if (schema.type && schema.type !== "integer") {
    const typeValid = validateType(schema.type, value);
    if (!typeValid) {
      errors.push({
        path,
        message: `Expected type ${schema.type}, got ${typeof value}`,
        schema,
        value,
      });
      return undefined;
    }
  }

  // Const validation
  if (schema.const !== undefined && value !== schema.const) {
    errors.push({
      path,
      message: `Value must be exactly ${JSON.stringify(schema.const)}`,
      schema,
      value,
    });
    return undefined;
  }

  // Enum validation
  if (schema.enum && !schema.enum.includes(value)) {
    errors.push({
      path,
      message: `Value must be one of: ${schema.enum.map((v) => JSON.stringify(v)).join(", ")}`,
      schema,
      value,
    });
    return undefined;
  }

  let result = value;

  // Object validation
  if (typeof value === "object" && !Array.isArray(value) && schema.properties) {
    // Handle JavaScript Error objects specially
    let obj: Record<string, Value>;
    if (value instanceof Error) {
      obj = {
        name: value.name,
        message: value.message,
        stack: value.stack,
        ...(value as any), // Include any additional properties
      };
    } else {
      obj = value as Record<string, Value>;
    }
    const validatedObj: Record<string, Value> = {};

    // Validate required properties
    if (schema.required) {
      for (const requiredProp of schema.required) {
        if (!(requiredProp in obj)) {
          if (schema.properties[requiredProp]?.default !== undefined) {
            validatedObj[requiredProp] = schema.properties[requiredProp].default!;
          } else {
            errors.push({
              path: path ? `${path}.${requiredProp}` : requiredProp,
              message: `Required property '${requiredProp}' is missing`,
              schema: schema.properties[requiredProp],
              value: undefined,
            });
          }
        }
      }
    }

    // Validate all properties
    for (const [prop, propValue] of Object.entries(obj)) {
      if (schema.properties && schema.properties[prop]) {
        const propSchema = schema.properties[prop];
        const propPath = path ? `${path}.${prop}` : prop;
        const validatedProp = validateValue(propSchema, propValue, propPath, errors, deps);
        if (validatedProp !== undefined) {
          validatedObj[prop] = validatedProp;
        }
      } else {
        // Allow additional properties by default (JSON Schema behavior)
        validatedObj[prop] = propValue;
      }
    }

    // Apply defaults for missing optional properties
    if (schema.properties) {
      for (const [prop, propSchema] of Object.entries(schema.properties)) {
        if (!(prop in validatedObj) && propSchema.default !== undefined) {
          validatedObj[prop] = propSchema.default;
        }
      }
    }

    result = validatedObj;
  }

  // Array validation
  if (Array.isArray(value)) {
    // Array length validation - check before processing items
    if (schema.minItems !== undefined && value.length < schema.minItems) {
      errors.push({
        path,
        message: `Array must have at least ${schema.minItems} items, got ${value.length}`,
        schema,
        value,
      });
      return undefined;
    }

    if (schema.maxItems !== undefined && value.length > schema.maxItems) {
      errors.push({
        path,
        message: `Array must have at most ${schema.maxItems} items, got ${value.length}`,
        schema,
        value,
      });
      return undefined;
    }

    if (schema.items) {
      const validatedArray: Value[] = [];

      if (Array.isArray(schema.items)) {
        // Tuple validation
        for (let i = 0; i < value.length; i++) {
          const itemSchema = schema.items[i];
          if (itemSchema) {
            const itemPath = `${path}[${i}]`;
            const validatedItem = validateValue(itemSchema, value[i], itemPath, errors, deps);
            if (validatedItem !== undefined) {
              validatedArray.push(validatedItem);
            }
          } else {
            validatedArray.push(value[i]);
          }
        }
      } else {
        // Single schema for all items
        for (let i = 0; i < value.length; i++) {
          const itemPath = `${path}[${i}]`;
          const validatedItem = validateValue(schema.items, value[i], itemPath, errors, deps);
          if (validatedItem !== undefined) {
            validatedArray.push(validatedItem);
          }
        }
      }

      result = validatedArray;
    } else {
      result = value;
    }
  }

  // String validation
  if (typeof value === "string") {
    if (schema.minLength !== undefined && value.length < schema.minLength) {
      errors.push({
        path,
        message: `String must be at least ${schema.minLength} characters long`,
        schema,
        value,
      });
      return undefined;
    }

    if (schema.maxLength !== undefined && value.length > schema.maxLength) {
      errors.push({
        path,
        message: `String must be at most ${schema.maxLength} characters long`,
        schema,
        value,
      });
      return undefined;
    }

    if (schema.pattern) {
      const regex = new RegExp(schema.pattern);
      if (!regex.test(value)) {
        errors.push({
          path,
          message: `String must match pattern: ${schema.pattern}`,
          schema,
          value,
        });
        return undefined;
      }
    }
  }

  // Number validation
  if (typeof value === "number") {
    if (schema.minimum !== undefined && value < schema.minimum) {
      errors.push({
        path,
        message: `Number must be at least ${schema.minimum}`,
        schema,
        value,
      });
      return undefined;
    }

    if (schema.maximum !== undefined && value > schema.maximum) {
      errors.push({
        path,
        message: `Number must be at most ${schema.maximum}`,
        schema,
        value,
      });
      return undefined;
    }

    if (schema.type === "integer" && !Number.isInteger(value)) {
      errors.push({
        path,
        message: "Number must be an integer",
        schema,
        value,
      });
      return undefined;
    }
  }

  // Integer type validation (after number validation)
  if (schema.type === "integer" && typeof value !== "number") {
    errors.push({
      path,
      message: `Expected type integer, got ${typeof value}`,
      schema,
      value,
    });
    return undefined;
  }

  return result;
}

function validateType(expectedType: string, value: Value): boolean {
  switch (expectedType) {
    case "string":
      return typeof value === "string";
    case "number":
      return typeof value === "number";
    case "integer":
      return typeof value === "number" && Number.isInteger(value);
    case "boolean":
      return typeof value === "boolean";
    case "null":
      return value === null;
    case "object":
      return typeof value === "object" && value !== null && !Array.isArray(value);
    case "array":
      return Array.isArray(value);
    default:
      return true; // Unknown type, assume valid
  }
}
