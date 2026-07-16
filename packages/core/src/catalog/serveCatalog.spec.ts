import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { createCatalogServer, shouldServeCatalogIndex } from "./serveCatalog";

describe("serveCatalog browser routing", () => {
  it("falls back to the application for browser routes", () => {
    expect(shouldServeCatalogIndex("/events/banner_click", true)).toBe(true);
    expect(shouldServeCatalogIndex("/events/auth%2Fsignup/definition", true)).toBe(true);
    expect(shouldServeCatalogIndex("/sets/production/events/order.completed", true)).toBe(true);
  });

  it("does not mask missing generated data or static assets", () => {
    expect(shouldServeCatalogIndex("/data/root/index.json", true)).toBe(false);
    expect(shouldServeCatalogIndex("/assets/missing.js", true)).toBe(false);
    expect(shouldServeCatalogIndex("/img/logo.png", true)).toBe(false);
    expect(shouldServeCatalogIndex("/favicon.ico", true)).toBe(false);
  });

  it("does not use an index fallback in hash-router mode", () => {
    expect(shouldServeCatalogIndex("/events/banner_click", false)).toBe(false);
  });

  it("serves a configured URL prefix without exposing the root", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "eventvisor-catalog-subpath-server-"));
    fs.writeFileSync(path.join(root, "index.html"), "<main>Catalog</main>");
    const server = createCatalogServer(root, true, "/event-catalog");
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Server address unavailable");
    try {
      expect((await fetch(`http://127.0.0.1:${address.port}/`)).status).toBe(404);
      expect(
        (await fetch(`http://127.0.0.1:${address.port}/event-catalog/events/page`)).status,
      ).toBe(200);
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });
});

describe("Catalog HTTP server", () => {
  it("serves JSON as JSON and browser routes as the application", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "eventvisor-catalog-server-"));
    fs.mkdirSync(path.join(root, "data"), { recursive: true });
    fs.writeFileSync(path.join(root, "index.html"), "<main>Catalog</main>");
    fs.writeFileSync(path.join(root, "data/manifest.json"), '{"schemaVersion":"1"}');
    const server = createCatalogServer(root, true);
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Server address unavailable");
    try {
      const manifest = await fetch(`http://127.0.0.1:${address.port}/data/manifest.json`);
      expect(manifest.headers.get("content-type")).toContain("application/json");
      expect(await manifest.json()).toEqual({ schemaVersion: "1" });

      const route = await fetch(`http://127.0.0.1:${address.port}/events/page`);
      expect(route.headers.get("content-type")).toContain("text/html");
      expect(await route.text()).toContain("Catalog");

      const missingData = await fetch(`http://127.0.0.1:${address.port}/data/missing.json`);
      expect(missingData.status).toBe(404);
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });
});
