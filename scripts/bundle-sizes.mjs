import { Buffer } from "node:buffer";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";
import { gzipSync } from "node:zlib";

import { minify as minifyWithTerser } from "terser";
import { build } from "vite";

const rootDirectoryPath = process.cwd();
const libraries = [
  { name: "@eventvisor/sdk", entry: "packages/sdk/src/index.ts", external: [] },
  {
    name: "@eventvisor/react",
    entry: "packages/react/src/index.tsx",
    external: ["react", "react-dom", "@eventvisor/sdk"],
  },
  ...[
    "amplitude-browser",
    "beacon",
    "console",
    "datadog-browser",
    "ga4",
    "gtm",
    "http",
    "localstorage",
    "mixpanel-browser",
    "newrelic-browser",
    "pixel",
    "segment-browser",
    "sentry-browser",
    "timestamp",
    "uuid",
  ].map((name) => ({
    name: `@eventvisor/module-${name}`,
    entry: `modules/module-${name}/src/index.ts`,
    external: ["@eventvisor/sdk"],
  })),
];

function formatBytes(bytes) {
  return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(2)} kB`;
}

function pad(value, width) {
  return `${value}${" ".repeat(Math.max(0, width - value.length))}`;
}

async function bundle(library, minify) {
  const temporaryDirectoryPath = await mkdtemp(path.join(tmpdir(), "eventvisor-bundle-sizes-"));
  const outputDirectoryPath = path.join(temporaryDirectoryPath, "output");
  try {
    await build({
      configFile: false,
      logLevel: "silent",
      build: {
        outDir: outputDirectoryPath,
        emptyOutDir: true,
        lib: {
          entry: path.join(rootDirectoryPath, library.entry),
          formats: ["es"],
          fileName: () => "bundle.js",
        },
        minify,
        sourcemap: false,
        reportCompressedSize: false,
        target: "es2015",
        rollupOptions: { external: library.external },
      },
    });
    return readFile(path.join(outputDirectoryPath, "bundle.js"));
  } finally {
    await rm(temporaryDirectoryPath, { recursive: true, force: true });
  }
}

function sizes(content) {
  return { bytes: content.byteLength, gzip: gzipSync(content).byteLength };
}

async function terser(content) {
  const result = await minifyWithTerser(content.toString(), {
    module: true,
    compress: { passes: 2 },
  });
  if (!result.code) throw new Error("Terser did not produce a bundle");
  return Buffer.from(result.code);
}

async function main() {
  const rows = [];
  for (const library of libraries) {
    const originalContent = await bundle(library, false);
    const original = sizes(originalContent);
    const esbuild = sizes(await bundle(library, "esbuild"));
    const terserSizes = sizes(await terser(originalContent));
    rows.push({
      name: library.name,
      original: formatBytes(original.bytes),
      esbuild: formatBytes(esbuild.bytes),
      esbuildGzip: formatBytes(esbuild.gzip),
      terser: formatBytes(terserSizes.bytes),
      terserGzip: formatBytes(terserSizes.gzip),
    });
  }

  const columns = ["name", "original", "esbuild", "esbuildGzip", "terser", "terserGzip"];
  const labels = {
    name: "Package",
    original: "Original",
    esbuild: "esbuild",
    esbuildGzip: "esbuild + gzip",
    terser: "Terser",
    terserGzip: "Terser + gzip",
  };
  const widths = Object.fromEntries(
    columns.map((column) => [
      column,
      Math.max(labels[column].length, ...rows.map((row) => row[column].length)),
    ]),
  );
  const line = (row) => columns.map((column) => pad(row[column], widths[column])).join("  ");

  console.log("Eventvisor bundle sizes");
  console.log(line(labels));
  console.log(columns.map((column) => "-".repeat(widths[column])).join("  "));
  rows.forEach((row) => console.log(line(row)));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
