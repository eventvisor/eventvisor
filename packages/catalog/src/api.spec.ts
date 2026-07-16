import type { CatalogManifest } from "./types";
import { validateManifest } from "./api";

describe("Catalog API", () => {
  const manifest = {
    schemaVersion: "1",
    generatedAt: "2026-01-01T00:00:00.000Z",
    sets: false,
    setKeys: [],
    projectConfig: { tags: [] },
    paths: { projectHistory: "data/project/history" },
    counts: {},
  } satisfies CatalogManifest;

  it("accepts the supported manifest schema", () => {
    expect(validateManifest(manifest)).toBe(manifest);
  });

  it("rejects unsupported and malformed manifests", () => {
    expect(() => validateManifest({ ...manifest, schemaVersion: "2" })).toThrow(
      "Unsupported Catalog schema version",
    );
    expect(() => validateManifest({ ...manifest, setKeys: undefined } as any)).toThrow(
      "Catalog manifest is invalid",
    );
  });
});
