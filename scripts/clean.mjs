/* global process */

import { rm } from "node:fs/promises";
import { join } from "node:path";

import { glob } from "node:fs/promises";

const roots = ["packages", "modules", "projects", "examples"];
const generatedDirectoryNames = new Set([
  "cjs",
  "coverage",
  "datafiles",
  "dist",
  "esm",
  "lib",
  "node-esm",
  "out",
]);

async function main() {
  for (const root of roots) {
    for await (const entry of glob(`${root}/*/*`, { withFileTypes: true })) {
      if (entry.isDirectory() && generatedDirectoryNames.has(entry.name)) {
        await rm(join(entry.parentPath, entry.name), { force: true, recursive: true });
      }
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
