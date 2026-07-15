import type {
  CatalogEntityType,
  CatalogIndex,
  CatalogManifest,
  EntityDetail,
  HistoryPage,
} from "./types";
import { encodeDataPath, getDataBasePath } from "./entityTypes";

let routerMode: CatalogManifest["router"] = "browser";
const dataUrl = (value: string) =>
  routerMode === "hash" ? value.replace(/^\//, "") : `/${value.replace(/^\//, "")}`;
export function setCatalogRouterMode(mode?: CatalogManifest["router"]) {
  routerMode = mode || "browser";
}
async function get<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Unable to load ${url}`);
  return response.json() as Promise<T>;
}
export function fetchManifest() {
  return get<CatalogManifest>(dataUrl("data/manifest.json")).catch(() =>
    get<CatalogManifest>("/data/manifest.json"),
  );
}
export function fetchIndex(set?: string) {
  return get<CatalogIndex>(dataUrl(`${getDataBasePath(set)}/index.json`));
}
export function fetchEntityDetail(type: CatalogEntityType, key: string, set?: string) {
  return get<EntityDetail>(
    dataUrl(`${getDataBasePath(set)}/entities/${type}/${encodeDataPath(key)}.json`),
  );
}
export async function fetchHistoryPage(path: string, page = 1) {
  const response = await fetch(dataUrl(`${path}/page-${page}.json`));
  if (response.status === 404 && page === 1)
    return { page: 1, pageSize: 50, totalPages: 1, entries: [] } as HistoryPage;
  if (!response.ok) throw new Error(`Unable to load history`);
  const type = response.headers.get("content-type") || "";
  return type.includes("text/html")
    ? ({ page: 1, pageSize: 50, totalPages: 1, entries: [] } as HistoryPage)
    : (response.json() as Promise<HistoryPage>);
}
