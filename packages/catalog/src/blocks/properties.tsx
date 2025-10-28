import React from "react";

type PropertyInfo = {
  path: string;
  type: string;
  required: boolean;
  description?: string;
  default?: any;
};

function flattenSchemaProperties(schema: any, basePath: string = ""): PropertyInfo[] {
  let results: PropertyInfo[] = [];
  if (!schema || typeof schema !== "object") return results;

  if (schema.type === "object" && schema.properties && typeof schema.properties === "object") {
    const keys = Object.keys(schema.properties);
    for (const key of keys) {
      const propSchema = schema.properties[key];
      // A property is required if it's listed in the current schema's required array
      const isRequired = (schema.required || []).includes(key);
      const fullPath = basePath ? `${basePath}.${key}` : key;

      if (
        propSchema.type === "object" &&
        propSchema.properties &&
        typeof propSchema.properties === "object"
      ) {
        // Add the intermediate object path if it has properties
        results.push({
          path: fullPath,
          type: "object",
          required: isRequired,
          description: propSchema.description,
          default: propSchema.default,
        });

        // Recursively flatten nested objects
        results = results.concat(flattenSchemaProperties(propSchema, fullPath));
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
          default: propSchema.default,
        });

        // If array items are objects with properties, also flatten them:
        if (propSchema.items && propSchema.items.type === "object" && propSchema.items.properties) {
          results = results.concat(flattenSchemaProperties(propSchema.items, `${fullPath}[]`));
        }
      } else {
        // Leaf property
        results.push({
          path: fullPath,
          type: propSchema.type || "any",
          required: isRequired,
          description: propSchema.description,
          default: propSchema.default,
        });
      }
    }
  }
  return results;
}

export const PropertiesTable: React.FC<{ schema: any }> = ({ schema }) => {
  const properties = flattenSchemaProperties(schema);

  if (!schema || !schema.properties || Object.keys(schema.properties).length === 0) {
    return (
      <div className="flex items-center justify-center p-8 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
        <div className="text-center">
          <div className="text-gray-400 text-4xl mb-2">📋</div>
          <p className="text-gray-500 text-sm font-medium">No properties defined</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
      {/* Table Header */}
      <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
        <h3 className="text-sm font-semibold text-gray-700">Properties</h3>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Path
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Type
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Required
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Description
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Default
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {properties.map((prop) => {
              return (
                <tr key={prop.path} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-2">
                    <code className="text-xs font-mono text-gray-800">{prop.path}</code>
                  </td>
                  <td className="px-4 py-2">
                    <span className="text-xs text-gray-700">{prop.type}</span>
                  </td>
                  <td className="px-4 py-2">
                    {prop.required ? (
                      <span className="text-xs text-green-700 font-medium">Yes</span>
                    ) : (
                      <span className="text-xs text-gray-400">No</span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <div className="text-xs text-gray-600">
                      {prop.description ? (
                        <span>{prop.description}</span>
                      ) : (
                        <span className="text-gray-300 italic">n/a</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2">
                    <div className="text-xs text-gray-600">
                      {prop.default !== undefined ? (
                        <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">
                          {typeof prop.default === "string"
                            ? `"${prop.default}"`
                            : String(prop.default)}
                        </code>
                      ) : (
                        <span className="text-gray-300 italic">n/a</span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export function Properties({ schema }: { schema: any }) {
  return <PropertiesTable schema={schema} />;
}
