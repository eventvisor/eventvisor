import React from "react";

type PropertyInfo = {
  path: string;
  type: string;
  required: boolean;
  description?: string;
};

function flattenSchemaProperties(
  schema: any,
  basePath: string = "",
  requiredList: string[] = [],
): PropertyInfo[] {
  let results: PropertyInfo[] = [];
  if (!schema || typeof schema !== "object") return results;

  if (schema.type === "object" && schema.properties && typeof schema.properties === "object") {
    const keys = Object.keys(schema.properties);
    for (const key of keys) {
      const propSchema = schema.properties[key];
      const isRequired = (schema.required || requiredList || []).includes(key);
      const fullPath = basePath ? `${basePath}.${key}` : key;

      if (
        propSchema.type === "object" &&
        propSchema.properties &&
        typeof propSchema.properties === "object"
      ) {
        // Recursively flatten nested objects
        results = results.concat(
          flattenSchemaProperties(propSchema, fullPath, propSchema.required),
        );
      } else if (propSchema.type === "array" && propSchema.items) {
        // Show the type as array of type if it's an array
        let itemType = "";
        if (propSchema.items.type) {
          itemType = propSchema.items.type;
        } else if (propSchema.items.$ref) {
          itemType = propSchema.items.$ref;
        } else if (propSchema.items) {
          itemType = "object";
        }
        results.push({
          path: fullPath,
          type: `array of ${itemType}`,
          required: isRequired,
          description: propSchema.description,
        });

        // If array items are objects with properties, also flatten them:
        if (propSchema.items && propSchema.items.type === "object" && propSchema.items.properties) {
          results = results.concat(
            flattenSchemaProperties(propSchema.items, `${fullPath}[]`, propSchema.items.required),
          );
        }
      } else {
        // Leaf property
        results.push({
          path: fullPath,
          type: propSchema.type || "any",
          required: isRequired,
          description: propSchema.description,
        });
      }
    }
  }
  return results;
}

export const PropertiesTable: React.FC<{ schema: any }> = ({ schema }) => {
  const properties = flattenSchemaProperties(schema, "", schema?.required || []);

  if (!schema || !schema.properties || Object.keys(schema.properties).length === 0) {
    return <div className="text-gray-500">No properties</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border border-gray-200 rounded-md bg-white">
        <thead>
          <tr className="bg-gray-50">
            <th className="text-left p-2 border-b text-xs font-semibold tracking-wider text-gray-700">
              Path
            </th>
            <th className="text-left p-2 border-b text-xs font-semibold tracking-wider text-gray-700">
              Type
            </th>
            <th className="text-left p-2 border-b text-xs font-semibold tracking-wider text-gray-700">
              Required
            </th>
            <th className="text-left p-2 border-b text-xs font-semibold tracking-wider text-gray-700">
              Description
            </th>
          </tr>
        </thead>
        <tbody>
          {properties.map((prop) => (
            <tr key={prop.path} className="border-b last:border-b-0">
              <td className="p-2 font-mono text-xs text-gray-800">{prop.path}</td>
              <td className="p-2 text-xs text-gray-700">{prop.type}</td>
              <td className="p-2 text-xs">
                {prop.required ? (
                  <span className="text-green-700 font-medium">Yes</span>
                ) : (
                  <span className="text-gray-400">No</span>
                )}
              </td>
              <td className="p-2 text-xs text-gray-600">
                {prop.description || <span className="text-gray-300 italic">n/a</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export function Properties({ schema }: { schema: any }) {
  return <PropertiesTable schema={schema} />;
}
