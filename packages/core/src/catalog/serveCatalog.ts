import * as fs from "fs";
import * as path from "path";
import * as http from "http";

import type { Dependencies } from "../dependencies";

const contentTypes: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

export function serveCatalog(deps: Dependencies) {
  const root = path.resolve(deps.projectConfig.catalogExportDirectoryPath);
  const port = Number(deps.options.port || deps.options.p || 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid catalog port.");

  const server = http.createServer((request, response) => {
    let pathname: string;
    try {
      pathname = decodeURIComponent(new URL(request.url || "/", "http://localhost").pathname);
    } catch {
      response.writeHead(400).end("Bad Request");
      return;
    }

    const relative = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
    const filePath = path.resolve(root, relative);
    if (filePath !== root && !filePath.startsWith(`${root}${path.sep}`)) {
      response.writeHead(403).end("Forbidden");
      return;
    }

    fs.readFile(filePath, (error, content) => {
      if (error) {
        response
          .writeHead(error.code === "ENOENT" ? 404 : 500)
          .end(error.code === "ENOENT" ? "Not Found" : "Internal Server Error");
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
  server.listen(port, "127.0.0.1");
  console.log(`Catalog available at http://127.0.0.1:${port}/`);
  return true;
}
