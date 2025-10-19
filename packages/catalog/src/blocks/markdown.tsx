import React from "react";
import ReactMarkdown from "react-markdown";

export const Markdown: React.FC<{ children: React.ReactNode; className?: string }> = (props) => {
  return (
    <div className={`prose prose-sm text-gray-700 ${props.className || ""}`}>
      <ReactMarkdown>{props.children as string}</ReactMarkdown>
    </div>
  );
};
