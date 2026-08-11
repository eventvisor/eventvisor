import { JSONSchema } from "@eventvisor/types";

import { getTypeScriptPropertyKey } from "./index";

function escapeDocComment(value: string): string {
  return value.replace(/\*\//g, "* /").replace(/\r?\n/g, "\n * ");
}

export function generateInterface(schema: JSONSchema, interfaceName: string): string {
  function generateType(schema: JSONSchema, indent: number = 0): string {
    const indentStr = "  ".repeat(indent);

    // Handle const
    if (schema.const !== undefined) {
      return JSON.stringify(schema.const);
    }

    // Handle enum
    if (schema.enum && schema.enum.length > 0) {
      const enumValues = schema.enum.map((val) => JSON.stringify(val));
      return enumValues.join(" | ");
    }

    // Handle array
    if (schema.type === "array") {
      if (schema.items) {
        if (Array.isArray(schema.items)) {
          // Tuple type
          const tupleTypes = schema.items.map((item) => generateType(item, indent));
          return `[${tupleTypes.join(", ")}]`;
        } else {
          // Array type
          const itemType = generateType(schema.items, indent);
          return `${itemType}[]`;
        }
      }
      return "any[]";
    }

    // Handle object
    if (schema.type === "object" || (schema.properties && !schema.type)) {
      if (!schema.properties || Object.keys(schema.properties).length === 0) {
        return schema.additionalProperties === true
          ? "Record<string, unknown>"
          : "Record<string, never>";
      }

      const required = schema.required || [];
      const properties = Object.entries(schema.properties).map(([key, propSchema]) => {
        const isRequired = required.includes(key);
        const optionalMarker = isRequired ? "" : "?";
        const propType = generateType(propSchema, indent + 1);
        return `${indentStr}  ${getTypeScriptPropertyKey(key)}${optionalMarker}: ${propType};`;
      });

      const indexSignature =
        schema.additionalProperties === true ? `${indentStr}  [key: string]: unknown;` : "";
      return `{\n${[...properties, indexSignature].filter(Boolean).join("\n")}\n${indentStr}}`;
    }

    // Handle primitives
    switch (schema.type) {
      case "string":
        return "string";
      case "number":
      case "integer":
        return "number";
      case "boolean":
        return "boolean";
      case "null":
        return "null";
      default:
        return "unknown";
    }
  }

  const typeDefinition = generateType(schema);

  // Use 'type' for primitives, arrays, tuples, enums, const, and Record types
  // Use 'interface' for object types with properties
  // Object types have property declarations (contain ': ' or '?: ' followed by type)
  // Const objects are JSON stringified and don't have property declarations
  const trimmed = typeDefinition.trim();
  const isArrayType = trimmed.endsWith("[]");
  const isObjectType =
    !isArrayType &&
    trimmed.startsWith("{") &&
    !trimmed.startsWith('{"') &&
    (trimmed.includes(":\n") ||
      trimmed.includes("?:\n") ||
      trimmed.includes(": ") ||
      trimmed.includes("?: "));
  const declarationType = isObjectType ? "interface" : "type";
  const separator = isObjectType ? " " : " = ";

  const description = schema.description ? `/** ${escapeDocComment(schema.description)} */\n` : "";

  return `${description}export ${declarationType} ${interfaceName}${separator}${typeDefinition}`;
}
