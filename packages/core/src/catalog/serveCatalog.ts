import * as fs from "fs";
import * as path from "path";
import * as http from "http";

import type { Dependencies } from "../dependencies";
import { CLI_COLOR_CYAN, CLI_FORMAT_GREEN, colorize } from "../tester/cliFormat";
import { normalizeCatalogBasePath } from "./exportCatalog";

const contentTypes: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

export function shouldServeCatalogIndex(pathname: string, browserRouter: boolean) {
  if (!browserRouter) return false;
  if (pathname === "/favicon.ico") return false;

  return !["/assets/", "/data/", "/img/"].some((prefix) => pathname.startsWith(prefix));
}

export function createCatalogServer(root: string, browserRouter: boolean, basePath = "") {
  return http.createServer((request, response) => {
    let pathname: string;
    try {
      pathname = decodeURIComponent(new URL(request.url || "/", "http://localhost").pathname);
    } catch {
      response.writeHead(400).end("Bad Request");
      return;
    }

    if (basePath) {
      if (pathname !== basePath && !pathname.startsWith(`${basePath}/`)) {
        response.writeHead(404).end("Not Found");
        return;
      }
      pathname = pathname.slice(basePath.length) || "/";
    }

    const relative =
      pathname === "/"
        ? "index.html"
        : pathname === "/favicon.ico"
          ? "img/logo.png"
          : pathname.replace(/^\/+/, "");
    const filePath = path.resolve(root, relative);
    if (filePath !== root && !filePath.startsWith(`${root}${path.sep}`)) {
      response.writeHead(403).end("Forbidden");
      return;
    }

    fs.readFile(filePath, (error, content) => {
      if (error) {
        if (error.code !== "ENOENT") {
          response.writeHead(500).end("Internal Server Error");
          return;
        }
        if (!shouldServeCatalogIndex(pathname, browserRouter)) {
          response.writeHead(404).end("Not Found");
          return;
        }
        fs.readFile(path.join(root, "index.html"), (indexError, indexContent) => {
          if (indexError) {
            response.writeHead(500).end("Catalog index.html not found");
            return;
          }
          response.writeHead(200, {
            "Content-Type": contentTypes[".html"],
            "X-Content-Type-Options": "nosniff",
            "Cache-Control": "no-cache",
          });
          response.end(indexContent);
        });
        return;
      }
      response.writeHead(200, {
        "Content-Type": contentTypes[path.extname(filePath)] || "application/octet-stream",
        "X-Content-Type-Options": "nosniff",
        "Cache-Control":
          path.basename(filePath) === "index.html" ? "no-cache" : "public, max-age=3600",
      });
      response.end(content);
    });
  });
}

export function serveCatalog(deps: Dependencies): Promise<http.Server> {
  const root = deps.options.outDir
    ? path.resolve(deps.rootDirectoryPath, deps.options.outDir)
    : path.resolve(deps.projectConfig.catalogExportDirectoryPath);
  const port = Number(deps.options.port || deps.options.p || 3000);
  const browserRouter = !(deps.options.hashRouter || deps.options["hash-router"]);
  const configuredBasePath = deps.options.basePath || deps.options["base-path"];
  const basePath = normalizeCatalogBasePath(configuredBasePath);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid catalog port.");

  const server = createCatalogServer(root, browserRouter, basePath);
  return new Promise((resolve, reject) => {
    const onError = (error: Error) => reject(error);
    server.once("error", onError);
    server.listen(port, "127.0.0.1", () => {
      server.off("error", onError);
      server.on("error", (error) => console.error(`Catalog server error: ${error.message}`));
      console.log("");
      console.log(CLI_FORMAT_GREEN, "Eventvisor catalog is available");
      console.log(`  ${colorize("URL", CLI_COLOR_CYAN)}: http://127.0.0.1:${port}${basePath}/`);
      console.log("");
      resolve(server);
    });
  });
}
