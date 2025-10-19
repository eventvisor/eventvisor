import React from "react";

import { TagIcon } from "@heroicons/react/20/solid";

import { Content } from "./content";
import { useEntitiesAsList } from "../hooks";
import { LinkAttribute } from "./links";
import { Alert } from "./alert";
import { LastModified } from "./last-modified";
import { Tag } from "./tag";
import { SearchInput } from "./search-input";
import { useSearch } from "../hooks";
import { getAttributesByQuery } from "../utils";

export const PageAttributes: React.FC = () => {
  const entities = useEntitiesAsList("attributes");
  const { searchQuery } = useSearch();

  const filteredEntities = getAttributesByQuery(searchQuery, entities);

  return (
    <Content title="Attributes">
      <SearchInput />

      {filteredEntities.length === 0 && <Alert type="warning">No results found</Alert>}

      {filteredEntities.length > 0 && (
        <div>
          <ul className="diving-gray-200 divide-y">
            {filteredEntities.map((entity: any) => (
              <li key={entity.name}>
                <LinkAttribute name={entity.name} className="block hover:bg-gray-50">
                  <div className="px-6 py-4">
                    <div className="flex items-center justify-between">
                      <p className="text-md relative font-bold text-zinc-600">
                        {entity.name}{" "}
                        {entity.archived && (
                          <span className="ml-1 rounded-full bg-red-100 px-2 py-1 text-xs font-medium text-red-800">
                            archived
                          </span>
                        )}
                      </p>

                      <div className="ml-2 flex flex-shrink-0 text-xs text-gray-500">
                        <div>
                          <TagIcon className="inline-block h-6 w-6 pr-1 text-xs text-gray-400" />
                          {entity.tags.map((tag: string) => (
                            <Tag tag={tag} key={tag} />
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="mt-2 flex justify-between">
                      <div className="flex">
                        <p className="line-clamp-3 max-w-md items-center text-sm text-gray-500">
                          {entity.description && entity.description.trim().length > 0
                            ? entity.description
                            : "n/a"}
                        </p>
                      </div>

                      <div className="items-top mt-2 flex text-xs text-gray-500 sm:mt-0">
                        <LastModified lastModified={entity.lastModified} />
                      </div>
                    </div>
                  </div>
                </LinkAttribute>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="mt-6 text-center text-sm text-gray-500">
        A total of <span className="font-bold">{filteredEntities.length}</span> results found.
      </p>
    </Content>
  );
};
