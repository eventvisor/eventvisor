/* global process */
import fs from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(packageRoot, "../..");

function getArg(name, fallback) {
  const prefix = `--${name}=`;
  const arg = process.argv.slice(2).find((value) => value.startsWith(prefix));

  return arg ? arg.slice(prefix.length) : fallback;
}

const project = path.resolve(packageRoot, getArg("project", "../../projects/project-1"));
const port = getArg("port", "3000");
const publicDir = path.join(packageRoot, ".catalog-dev");
const hashRouter = process.argv.slice(2).includes("--hash-router");
const openBrowser = !process.argv.slice(2).includes("--no-open");
const ignoredProjectEntries = new Set([
  ".git",
  "node_modules",
  ".eventvisor",
  "datafiles",
  "catalog",
  "out",
]);

function getExportArgs() {
  const args = [
    path.join(repoRoot, "packages/cli/bin.js"),
    "catalog",
    "export",
    "--out-dir",
    publicDir,
    "--no-assets",
  ];

  if (hashRouter) args.push("--hash-router");

  return args;
}

function syncCatalogPackagePublicAssets() {
  const sourceDirectoryPath = path.join(packageRoot, "public");

  if (!fs.existsSync(sourceDirectoryPath)) return;

  fs.mkdirSync(publicDir, { recursive: true });
  fs.cpSync(sourceDirectoryPath, publicDir, { recursive: true });
}

function shouldIgnoreProjectPath(targetPath) {
  const relativePath = path.relative(project, targetPath);

  if (!relativePath || relativePath.startsWith("..")) return false;

  return relativePath.split(path.sep).some((part) => ignoredProjectEntries.has(part));
}

function watchProjectTree(rootDirectoryPath, onChange) {
  function collectSnapshotEntries(directoryPath, snapshotEntries) {
    if (shouldIgnoreProjectPath(directoryPath)) return;

    let entries;
    try {
      entries = fs.readdirSync(directoryPath, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const entryPath = path.join(directoryPath, entry.name);

      if (shouldIgnoreProjectPath(entryPath)) continue;
      if (entry.isDirectory()) {
        collectSnapshotEntries(entryPath, snapshotEntries);
        continue;
      }
      if (!entry.isFile()) continue;

      try {
        const stat = fs.statSync(entryPath);
        const relativePath = path.relative(rootDirectoryPath, entryPath);
        snapshotEntries.push(`${relativePath}:${stat.size}:${stat.mtimeMs}`);
      } catch {
        // Ignore transient filesystem races while editors save files.
      }
    }
  }

  function createSnapshot() {
    const snapshotEntries = [];
    collectSnapshotEntries(rootDirectoryPath, snapshotEntries);
    snapshotEntries.sort();
    return snapshotEntries.join("|");
  }

  let previousSnapshot = createSnapshot();
  const poller = setInterval(() => {
    const nextSnapshot = createSnapshot();

    if (nextSnapshot === previousSnapshot) return;

    previousSnapshot = nextSnapshot;
    onChange(rootDirectoryPath);
  }, 250);

  return () => clearInterval(poller);
}

for (const workspace of ["@eventvisor/catalog", "@eventvisor/core", "@eventvisor/cli"]) {
  const buildResult = spawnSync("npm", ["run", "build", "--workspace", workspace], {
    cwd: repoRoot,
    stdio: "inherit",
    env: process.env,
  });

  if (buildResult.status !== 0) process.exit(buildResult.status || 1);
}

const exportResult = spawnSync("node", getExportArgs(), {
  cwd: project,
  stdio: "inherit",
  env: process.env,
});

if (exportResult.status !== 0) process.exit(exportResult.status || 1);

syncCatalogPackagePublicAssets();

let exportInFlight = false;
let exportQueued = false;
let debounceTimer = null;

function runCatalogExport(reason) {
  if (exportInFlight) {
    exportQueued = true;
    return;
  }

  exportInFlight = true;
  console.log(`\n[catalog] Re-exporting because ${reason}`);

  const child = spawn("node", getExportArgs(), {
    cwd: project,
    stdio: "inherit",
    env: process.env,
  });

  child.on("close", (code) => {
    exportInFlight = false;

    if (code !== 0) console.error(`[catalog] Export failed with exit code ${code || 1}`);
    else syncCatalogPackagePublicAssets();

    if (exportQueued) {
      exportQueued = false;
      runCatalogExport("more project changes");
    }
  });
}

function scheduleCatalogExport(changedPath) {
  const relativePath = path.relative(project, changedPath) || ".";
  const reason = `project change in ${relativePath}`;

  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    runCatalogExport(reason);
  }, 150);
}

const stopWatchingProject = watchProjectTree(project, scheduleCatalogExport);

const viteArgs = ["vite", "--host", "127.0.0.1", "--port", port];
if (openBrowser) viteArgs.push("--open");
const vite = spawn("npx", viteArgs, {
  cwd: packageRoot,
  stdio: "inherit",
  env: {
    ...process.env,
    CATALOG_PUBLIC_DIR: publicDir,
  },
});

vite.on("close", (code) => {
  stopWatchingProject();
  process.exit(code || 0);
});
