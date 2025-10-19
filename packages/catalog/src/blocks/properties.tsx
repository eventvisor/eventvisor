import React from "react";

// @TODO: Improve the display of the properties
export function Properties(props: any) {
  const { properties } = props;

  return (
    <pre className="bg-gray-100 p-4 rounded-md font-mono text-xs text-gray-600 border border-gray-200">
      <code>{JSON.stringify(properties, null, 2)}</code>
    </pre>
  );
}
