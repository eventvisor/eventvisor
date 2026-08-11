/* global process */

import { readFile } from "node:fs/promises";

const accepted = new Set([
  "0BSD",
  "Apache-2.0",
  "Apache-2.0 AND MIT",
  "BSD-2-Clause",
  "BSD-3-Clause",
  "BlueOak-1.0.0",
  "CC-BY-3.0",
  "CC-BY-4.0",
  "CC0-1.0",
  "ISC",
  "MIT",
  "MIT-0",
  "MPL-2.0",
  "Python-2.0",
  "(MIT OR CC0-1.0)",
]);

async function main() {
  const lockfile = JSON.parse(await readFile(new URL("../package-lock.json", import.meta.url)));
  const rejected = [];
  const summary = new Map();

  for (const [path, entry] of Object.entries(lockfile.packages || {})) {
    if (!path.includes("node_modules/") || !entry.version) continue;
    const license = entry.license;
    summary.set(license || "missing", (summary.get(license || "missing") || 0) + 1);
    if (!license || !accepted.has(license)) rejected.push(`${path}: ${license || "missing"}`);
  }

  if (rejected.length > 0) {
    throw new Error(`Review unapproved dependency licences:\n${rejected.join("\n")}`);
  }

  console.log(
    `Checked ${[...summary.values()].reduce((total, count) => total + count, 0)} dependencies across ${summary.size} approved licences.`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
