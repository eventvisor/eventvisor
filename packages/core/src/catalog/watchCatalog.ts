import * as fs from "fs";
import * as path from "path";

import { CONFIG_MODULE_NAME, ProjectConfig } from "../config";

function isIgnored(targetPath: string, ignoredDirectoryPaths: string[]) {
  const resolvedTargetPath = path.resolve(targetPath);

  return ignoredDirectoryPaths.some((ignoredDirectoryPath) => {
    const resolvedIgnoredPath = path.resolve(ignoredDirectoryPath);

    return (
      resolvedTargetPath === resolvedIgnoredPath ||
      resolvedTargetPath.startsWith(`${resolvedIgnoredPath}${path.sep}`)
    );
  });
}

export function getCatalogInputWatchPaths(rootDirectoryPath: string, projectConfig: ProjectConfig) {
  const watchPaths = [path.join(rootDirectoryPath, CONFIG_MODULE_NAME)];

  if (projectConfig.sets) {
    watchPaths.push(projectConfig.setsDirectoryPath);
  } else {
    watchPaths.push(
      projectConfig.eventsDirectoryPath,
      projectConfig.attributesDirectoryPath,
      projectConfig.destinationsDirectoryPath,
      projectConfig.effectsDirectoryPath,
      projectConfig.schemasDirectoryPath,
      projectConfig.testsDirectoryPath,
      projectConfig.targetsDirectoryPath,
    );
  }

  return [...new Set(watchPaths.filter(Boolean).map((entry) => path.resolve(entry)))];
}

export function createCatalogInputSnapshot(
  rootDirectoryPath: string,
  projectConfig: ProjectConfig,
  ignoredDirectoryPaths: string[],
) {
  const snapshot = new Map<string, string>();

  function collect(directoryPath: string) {
    if (isIgnored(directoryPath, ignoredDirectoryPaths)) return;

    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(directoryPath, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const entryPath = path.join(directoryPath, entry.name);
      if (isIgnored(entryPath, ignoredDirectoryPaths)) continue;
      if (entry.isDirectory()) {
        collect(entryPath);
        continue;
      }
      if (!entry.isFile()) continue;

      try {
        const stat = fs.statSync(entryPath);
        snapshot.set(entryPath, `${stat.size}:${stat.mtimeMs}`);
      } catch {
        // Editors may briefly remove or replace files while saving.
      }
    }
  }

  for (const watchPath of getCatalogInputWatchPaths(rootDirectoryPath, projectConfig)) {
    if (isIgnored(watchPath, ignoredDirectoryPaths) || !fs.existsSync(watchPath)) continue;

    try {
      const stat = fs.statSync(watchPath);
      if (stat.isFile()) snapshot.set(watchPath, `${stat.size}:${stat.mtimeMs}`);
      else if (stat.isDirectory()) collect(watchPath);
    } catch {
      // Ignore transient filesystem races.
    }
  }

  return snapshot;
}

export function getCatalogSnapshotChanges(
  previous: Map<string, string>,
  next: Map<string, string>,
) {
  const changes = new Set<string>();

  for (const [filePath, signature] of next) {
    if (previous.get(filePath) !== signature) changes.add(filePath);
  }
  for (const filePath of previous.keys()) {
    if (!next.has(filePath)) changes.add(filePath);
  }

  return [...changes];
}

export function createCatalogInputWatcher(
  rootDirectoryPath: string,
  projectConfig: ProjectConfig,
  ignoredDirectoryPaths: string[],
  onChange: (changedPaths: string[]) => void,
  intervalMs = 250,
) {
  let previous = createCatalogInputSnapshot(
    rootDirectoryPath,
    projectConfig,
    ignoredDirectoryPaths,
  );

  const interval = setInterval(() => {
    const next = createCatalogInputSnapshot(
      rootDirectoryPath,
      projectConfig,
      ignoredDirectoryPaths,
    );
    const changes = getCatalogSnapshotChanges(previous, next);
    previous = next;
    if (changes.length > 0) onChange(changes);
  }, intervalMs);

  return () => clearInterval(interval);
}
