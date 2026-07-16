/* global process */
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const workspaceRoots = ["packages", "modules"];
const packageDirectories = workspaceRoots.flatMap((directory) =>
  readdirSync(join(root, directory))
    .map((name) => join(root, directory, name))
    .filter((candidate) => existsSync(join(candidate, "package.json"))),
);
const require = createRequire(import.meta.url);

async function main() {
  const npmCache = mkdtempSync(join(tmpdir(), "eventvisor-release-check-"));
  try {
    for (const directory of packageDirectories) {
      const manifest = JSON.parse(readFileSync(join(directory, "package.json"), "utf8"));
      if (manifest.private) continue;

      const result = JSON.parse(
        execFileSync("npm", ["pack", "--dry-run", "--json", "--ignore-scripts"], {
          cwd: directory,
          encoding: "utf8",
          env: { ...process.env, npm_config_cache: npmCache },
        }),
      )[0];
      const packedFiles = new Set(result.files.map((file) => file.path));

      for (const field of ["main", "module", "types"]) {
        const entry = manifest[field];
        if (entry && !packedFiles.has(entry.replace(/^\.\//, ""))) {
          throw new Error(
            `${manifest.name}: ${field} entry "${entry}" is missing from the package.`,
          );
        }
      }

      if (manifest.main && manifest.name !== "@eventvisor/cli") {
        require(join(directory, manifest.main));
      }
      if (manifest.module) {
        await import(pathToFileURL(join(directory, manifest.module)).href);
      }

      console.log(`✓ ${manifest.name} (${result.entryCount} files, ${result.size} bytes)`);
    }
  } finally {
    rmSync(npmCache, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
