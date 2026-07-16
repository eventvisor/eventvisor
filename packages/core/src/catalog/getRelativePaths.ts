import * as path from "path";

import { ProjectConfig } from "../config";

export function getRelativePaths(rootDirectoryPath, projectConfig: ProjectConfig) {
  const relativeEventsPath = path.relative(rootDirectoryPath, projectConfig.eventsDirectoryPath);
  const relativeDestinationsPath = path.relative(
    rootDirectoryPath,
    projectConfig.destinationsDirectoryPath,
  );
  const relativeAttributesPath = path.relative(
    rootDirectoryPath,
    projectConfig.attributesDirectoryPath,
  );
  const relativeEffectsPath = path.relative(rootDirectoryPath, projectConfig.effectsDirectoryPath);
  const relativeSchemasPath = path.relative(rootDirectoryPath, projectConfig.schemasDirectoryPath);

  return {
    relativeEventsPath,
    relativeDestinationsPath,
    relativeAttributesPath,
    relativeEffectsPath,
    relativeSchemasPath,
  };
}
