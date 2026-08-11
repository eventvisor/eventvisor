import type {
  CatalogEntityType,
  CatalogIndex,
  CatalogManifest,
  EntityDetail,
  HistoryPage,
} from "./types";
import { encodeDataPath, getDataBasePath } from "./entityTypes";

let catalogBaseUrl: URL | undefined;
const defaultBaseUrl = () => {
  const script = Array.from(document.scripts).find((candidate) =>
    new URL(candidate.src || document.baseURI, document.baseURI).pathname.includes("/assets/"),
  );
  if (script?.src) {
    const scriptUrl = new URL(script.src, document.baseURI);
    const prefix = scriptUrl.pathname.slice(0, scriptUrl.pathname.lastIndexOf("/assets/") + 1);
    return new URL(prefix, scriptUrl.origin);
  }
  return new URL("./", document.baseURI);
};
const dataUrl = (value: string) =>
  new URL(value.replace(/^\//, ""), catalogBaseUrl || defaultBaseUrl()).toString();
export const catalogAssetUrl = (value: string) => dataUrl(value);
async function get<T>(
  url: string,
  signal?: AbortSignal,
): Promise<{ value: T; response: Response }> {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`Unable to load ${url}: HTTP ${response.status}`);
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("json")) {
    throw new Error(
      `Unable to load ${url}: expected JSON but received ${contentType || "unknown content"}`,
    );
  }
  try {
    return { value: (await response.json()) as T, response };
  } catch {
    throw new Error(`Unable to load ${url}: invalid JSON`);
  }
}
export function validateManifest(manifest: CatalogManifest) {
  if (manifest.schemaVersion !== "1") {
    throw new Error(`Unsupported Catalog schema version "${manifest.schemaVersion || "unknown"}".`);
  }
  if (typeof manifest.sets !== "boolean" || !Array.isArray(manifest.setKeys)) {
    throw new Error("Catalog manifest is invalid.");
  }
  return manifest;
}
export async function fetchManifest() {
  const candidates = [
    new URL("data/manifest.json", defaultBaseUrl()).toString(),
    new URL("data/manifest.json", document.baseURI).toString(),
    new URL("/data/manifest.json", window.location.origin).toString(),
  ];
  let lastError: unknown;
  for (const candidate of [...new Set(candidates)]) {
    try {
      const { value, response } = await get<CatalogManifest>(candidate);
      catalogBaseUrl = new URL("../", response.url);
      return validateManifest(value);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}
export function fetchIndex(set?: string) {
  return get<CatalogIndex>(dataUrl(`${getDataBasePath(set)}/index.json`)).then(
    ({ value }) => value,
  );
}
export function fetchEntityDetail(
  type: CatalogEntityType,
  key: string,
  set?: string,
  signal?: AbortSignal,
) {
  return get<EntityDetail>(
    dataUrl(`${getDataBasePath(set)}/entities/${type}/${encodeDataPath(key)}.json`),
    signal,
  ).then(({ value }) => value);
}
export async function fetchHistoryPage(path: string, page = 1) {
  try {
    return (await get<HistoryPage>(dataUrl(`${path}/page-${page}.json`))).value;
  } catch (error) {
    if (page === 1 && error instanceof Error && error.message.includes("404")) {
      return { page: 1, pageSize: 50, totalPages: 1, entries: [] } as HistoryPage;
    }
    throw error;
  }
}
