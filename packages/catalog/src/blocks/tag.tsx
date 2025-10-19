import * as React from "react";

interface TagProps {
  tag: string;
}

export function Tag(props: TagProps) {
  return (
    <span className="mr-1 rounded-full border-zinc-400 bg-zinc-300 px-2 py-1 text-xs text-gray-600">
      {props.tag}
    </span>
  );
}
