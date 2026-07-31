/* global process */

import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packageDirectories = ["packages", "modules"].flatMap((area) =>
  readdirSync(join(root, area))
    .map((name) => join(root, area, name))
    .filter((directory) => existsSync(join(directory, "package.json"))),
);
const temporaryRoot = mkdtempSync(join(tmpdir(), "eventvisor-packages-"));
const modulesRoot = join(temporaryRoot, "node_modules");
const cache = join(temporaryRoot, "npm-cache");

function linkExternalDependency(name) {
  const destination = join(modulesRoot, name);
  if (existsSync(destination)) return;
  const source = join(root, "node_modules", name);
  if (!existsSync(source)) throw new Error(`Installed dependency ${name} was not found.`);
  mkdirSync(dirname(destination), { recursive: true });
  symlinkSync(source, destination, "junction");
}

function collectTargets(value) {
  if (typeof value === "string") return [value];
  if (!value || typeof value !== "object") return [];
  return Object.values(value).flatMap(collectTargets);
}

try {
  mkdirSync(modulesRoot, { recursive: true });
  const manifests = [];

  for (const directory of packageDirectories) {
    const manifest = JSON.parse(readFileSync(join(directory, "package.json"), "utf8"));
    if (manifest.private) continue;

    const output = JSON.parse(
      execFileSync("npm", ["pack", "--json", "--pack-destination", temporaryRoot], {
        cwd: directory,
        encoding: "utf8",
        env: { ...process.env, npm_config_cache: cache },
      }),
    )[0];
    const packedFiles = new Set(output.files.map(({ path }) => path));
    const unwantedFiles = [...packedFiles].filter(
      (file) =>
        file.endsWith(".DS_Store") ||
        /\.spec\.[cm]?[jt]sx?(?:\.map)?$/.test(file) ||
        /(?:^|\/)(?:jest\.config\.[cm]?js|tsconfig(?:\.[^/]+)?\.json)$/.test(file) ||
        file.includes("test-fixtures") ||
        (!["@eventvisor/types"].includes(manifest.name) && file.startsWith("src/")),
    );
    if (unwantedFiles.length > 0) {
      throw new Error(`${manifest.name} contains non-runtime files: ${unwantedFiles.join(", ")}`);
    }

    for (const [label, target] of [
      ["main", manifest.main],
      ["module", manifest.module],
      ["types", manifest.types],
      ...Object.entries(manifest.bin || {}).map(([name, value]) => [`bin ${name}`, value]),
      ...collectTargets(manifest.exports?.["."]).map((value) => ["root export", value]),
      ...(manifest.exports?.["./package.json"]
        ? [["package.json export", manifest.exports["./package.json"]]]
        : []),
    ]) {
      if (typeof target === "string" && !packedFiles.has(target.replace(/^\.\//, ""))) {
        throw new Error(`${manifest.name} ${label} target ${target} is missing from the package.`);
      }
    }

    const tarball = join(temporaryRoot, output.filename);
    const destination = join(modulesRoot, manifest.name);
    mkdirSync(destination, { recursive: true });
    execFileSync("tar", ["-xzf", tarball, "--strip-components=1", "-C", destination]);
    manifests.push(manifest);
    console.log(`✓ ${manifest.name} (${output.entryCount} files, ${output.size} bytes)`);
  }

  for (const manifest of manifests) {
    if (manifest.name.startsWith("@eventvisor/module-")) {
      if (manifest.dependencies?.["@eventvisor/sdk"]) {
        throw new Error(`${manifest.name} must use @eventvisor/sdk as a peer dependency.`);
      }
      if (!manifest.peerDependencies?.["@eventvisor/sdk"]) {
        throw new Error(`${manifest.name} must declare @eventvisor/sdk as a peer dependency.`);
      }
    }

    for (const dependency of Object.keys({
      ...(manifest.dependencies || {}),
      ...(manifest.peerDependencies || {}),
    })) {
      if (!dependency.startsWith("@eventvisor/")) linkExternalDependency(dependency);
    }
  }

  const runtimePackages = manifests
    .filter(({ name, main }) => main && !["@eventvisor/cli", "@eventvisor/catalog"].includes(name))
    .map(({ name }) => name);
  execFileSync(
    process.execPath,
    ["-e", `for (const name of ${JSON.stringify(runtimePackages)}) require(name);`],
    { cwd: temporaryRoot, stdio: "inherit" },
  );
  execFileSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      "await import('@eventvisor/sdk'); await import('@eventvisor/react')",
    ],
    { cwd: temporaryRoot, stdio: "inherit" },
  );

  const consumerRoot = join(temporaryRoot, "typescript-consumer");
  mkdirSync(consumerRoot);
  for (const dependency of ["@types/node", "@types/react", "@types/react-dom"]) {
    linkExternalDependency(dependency);
  }
  writeFileSync(
    join(consumerRoot, "index.ts"),
    [
      'import { createEventvisor, type Eventvisor, type EventvisorOptions } from "@eventvisor/sdk";',
      'import { EventvisorProvider } from "@eventvisor/react";',
      'import type { Parser } from "@eventvisor/parsers";',
      "const options: EventvisorOptions = {};",
      "const eventvisor: Eventvisor = createEventvisor(options);",
      'const parser: Parser = "yml";',
      "void eventvisor; void EventvisorProvider; void parser;",
    ].join("\n"),
  );
  writeFileSync(
    join(consumerRoot, "tsconfig.json"),
    JSON.stringify(
      {
        compilerOptions: {
          lib: ["ES2022", "DOM"],
          module: "NodeNext",
          moduleResolution: "NodeNext",
          noEmit: true,
          skipLibCheck: false,
          strict: true,
          target: "ES2022",
        },
        files: ["index.ts"],
      },
      null,
      2,
    ),
  );
  execFileSync(
    process.execPath,
    [join(root, "node_modules/typescript/bin/tsc"), "-p", consumerRoot],
    {
      cwd: consumerRoot,
      stdio: "inherit",
    },
  );

  console.log(`Validated ${manifests.length} packed Eventvisor packages and clean consumers.`);
} finally {
  rmSync(temporaryRoot, { recursive: true, force: true });
}
