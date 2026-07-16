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

const CATALOG_LIVE_RELOAD_PATH = "/__eventvisor_catalog_reload";

export interface CatalogServerHandle {
  close: () => Promise<void>;
  triggerReload: () => void;
}

interface CatalogLiveReloadOptions {
  clients: Set<http.ServerResponse>;
}

function injectLiveReload(html: string, basePath: string) {
  const endpoint = `${basePath}${CATALOG_LIVE_RELOAD_PATH}`;
  const script = [
    "<script>",
    "(() => {",
    `  const source = new EventSource(${JSON.stringify(endpoint)});`,
    '  source.addEventListener("reload", () => window.location.reload());',
    "  source.onerror = () => {",
    "    source.close();",
    "    setTimeout(() => window.location.reload(), 1000);",
    "  };",
    "})();",
    "</script>",
  ].join("");

  return html.includes("</body>")
    ? html.replace("</body>", `${script}</body>`)
    : `${html}${script}`;
}

export function shouldServeCatalogIndex(pathname: string, browserRouter: boolean) {
  if (!browserRouter) return false;
  if (pathname === "/favicon.ico") return false;

  return !["/assets/", "/data/", "/img/"].some((prefix) => pathname.startsWith(prefix));
}

export function createCatalogServer(
  root: string,
  browserRouter: boolean,
  basePath = "",
  liveReload?: CatalogLiveReloadOptions,
) {
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

    if (liveReload && pathname === CATALOG_LIVE_RELOAD_PATH) {
      response.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      });
      response.write("\n");
      liveReload.clients.add(response);
      request.on("close", () => liveReload.clients.delete(response));
      return;
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

    const sendContent = (servedFilePath: string, content: Buffer) => {
      const isIndex = path.basename(servedFilePath) === "index.html";
      response.writeHead(200, {
        "Content-Type": contentTypes[path.extname(servedFilePath)] || "application/octet-stream",
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": liveReload || isIndex ? "no-cache" : "public, max-age=3600",
      });
      response.end(
        liveReload && isIndex ? injectLiveReload(content.toString("utf8"), basePath) : content,
      );
    };

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
          sendContent(path.join(root, "index.html"), indexContent);
        });
        return;
      }
      sendContent(filePath, content);
    });
  });
}

export function serveCatalog(
  deps: Dependencies,
  options: { liveReload?: boolean } = {},
): Promise<CatalogServerHandle> {
  const root = deps.options.outDir
    ? path.resolve(deps.rootDirectoryPath, deps.options.outDir)
    : path.resolve(deps.projectConfig.catalogExportDirectoryPath);
  const port = Number(deps.options.port || deps.options.p || 3000);
  const browserRouter = !(deps.options.hashRouter || deps.options["hash-router"]);
  const configuredBasePath = deps.options.basePath || deps.options["base-path"];
  const basePath = normalizeCatalogBasePath(configuredBasePath);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid catalog port.");

  const liveReloadClients = new Set<http.ServerResponse>();
  const server = createCatalogServer(
    root,
    browserRouter,
    basePath,
    options.liveReload ? { clients: liveReloadClients } : undefined,
  );
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
      resolve({
        close: () =>
          new Promise<void>((closeResolve, closeReject) => {
            for (const client of liveReloadClients) client.end();
            liveReloadClients.clear();
            server.close((error) => (error ? closeReject(error) : closeResolve()));
          }),
        triggerReload: () => {
          for (const client of liveReloadClients) {
            client.write("event: reload\n");
            client.write("data: reload\n\n");
          }
        },
      });
    });
  });
}
