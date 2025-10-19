import React from "react";
import clsx from "clsx";
import { ArrowTopRightOnSquareIcon } from "@heroicons/react/20/solid";

import { useEntityEditLink } from "../hooks";

export const Content: React.FC<{
  children: React.ReactNode;
  title: string;
  border?: boolean;
  entityType?: string;
  entityName?: string;
}> = ({ children, border = true, title, entityType, entityName }) => {
  const editLink = useEntityEditLink(entityType ?? "", entityName ?? "");

  return (
    <div className="max-w-3xl">
      <div>
        <h1
          className={clsx(
            "mb-0 m-4 pt-4 text-3xl font-black text-zinc-700 pb-4 relative",
            border && "border-b border-zinc-200",
          )}
        >
          {title}

          {editLink && (
            <a
              href={editLink}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-zinc-500 hover:text-zinc-700 hover:bg-zinc-300 font-medium inline-block absolute right-0 top-4 bg-zinc-200 py-2 px-3 rounded-md"
            >
              <ArrowTopRightOnSquareIcon className="w-4 h-4 inline-block" /> Edit
            </a>
          )}
        </h1>
      </div>

      {children}
    </div>
  );
};
