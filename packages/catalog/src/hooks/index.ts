import React from "react";
import { useSearchParams } from "react-router";

import { CatalogContext } from "../contexts";

export function useCatalog() {
  return React.useContext(CatalogContext);
}

export type EntitiesType = "attributes" | "events" | "destinations" | "effects";

export function useEntities(type: EntitiesType) {
  const catalog = useCatalog();

  if (!catalog) {
    return [];
  }

  return catalog.entities[type];
}

export function useEntityEditLink(entityType: string, entityName: string) {
  const catalog = useCatalog();

  if (!catalog) {
    return;
  }

  const link = catalog.links?.[entityType as keyof typeof catalog.links];

  if (!link) {
    return;
  }

  return link.replace("{{name}}", entityName);
}

export function useEntitiesAsList(type: EntitiesType) {
  const entities = useEntities(type);

  const list = React.useMemo(() => {
    const arr = [];

    for (const [key, value] of Object.entries(entities)) {
      arr.push({
        name: key,
        ...value,
      });
    }

    return arr;
  }, [entities]);

  return list;
}

export function useEntityNames(type: EntitiesType) {
  const catalog = useCatalog();

  if (!catalog) {
    return [];
  }

  return Object.keys(catalog.entities[type]);
}

export function useEntity(type: EntitiesType, name: string) {
  const catalog = useCatalog();

  if (!catalog) {
    return undefined;
  }

  return catalog.entities[type][name];
}

export const SEARCH_QUERY_KEY = "q";

export function useSearch() {
  const [searchParams, setSearchParams] = useSearchParams();
  const searchQuery = String(searchParams.get(SEARCH_QUERY_KEY) || "");

  const setSearchQuery = React.useCallback((value: string) => {
    const newSearchParams = new URLSearchParams(searchParams.toString());

    if (value) {
      newSearchParams.set(SEARCH_QUERY_KEY, String(value));
    } else {
      newSearchParams.delete(SEARCH_QUERY_KEY);
    }
    setSearchParams(newSearchParams);
  }, []);

  return {
    searchQuery,
    setSearchQuery,
  } as const;
}
