import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

import path from "path";

function catalogDataLiveReload(): Plugin {
  return {
    name: "eventvisor-catalog-data-live-reload",
    configureServer(server) {
      const publicDir = path.resolve(process.env.CATALOG_PUBLIC_DIR || "public");
      const dataDirectoryPath = path.join(publicDir, "data");
      let reloadTimer: ReturnType<typeof setTimeout> | undefined;

      server.watcher.add(dataDirectoryPath);
      server.watcher.on("all", (_event: string, changedPath: string) => {
        const relativePath = path.relative(dataDirectoryPath, changedPath);
        if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) return;

        clearTimeout(reloadTimer);
        reloadTimer = setTimeout(() => {
          server.ws.send({ type: "full-reload", path: "*" });
        }, 100);
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), catalogDataLiveReload()],
  publicDir: process.env.CATALOG_PUBLIC_DIR || "public",
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
