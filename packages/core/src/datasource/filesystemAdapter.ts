import * as fs from "fs";
import * as path from "path";
import { execSync, spawn } from "child_process";

import type {
  DatafileContent,
  EntityType,
  HistoryEntry,
  HistoryEntity,
  Commit,
} from "@eventvisor/types";

import { Adapter, DatafileOptions } from "./adapter";
import { ProjectConfig, CustomParser } from "../config";
import { getCommit } from "../utils/git";

export function getRevisionFilePath(projectConfig: ProjectConfig): string {
  return path.join(projectConfig.systemDirectoryPath, `REVISION`);
}

export function getAllEntityFilePathsRecursively(directoryPath, extension) {
  let entities: string[] = [];

  if (!fs.existsSync(directoryPath)) {
    return entities;
  }

  const files = fs.readdirSync(directoryPath);

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const filePath = path.join(directoryPath, file);

    if (fs.statSync(filePath).isDirectory()) {
      entities = entities.concat(getAllEntityFilePathsRecursively(filePath, extension));
    } else if (file.endsWith(`.${extension}`)) {
      entities.push(filePath);
    }
  }

  return entities;
}

export class FilesystemAdapter extends Adapter {
  private parser: CustomParser;

  constructor(
    private config: ProjectConfig,
    private rootDirectoryPath?: string,
  ) {
    super();

    this.parser = config.parser as CustomParser;
  }

  getEntityDirectoryPath(entityType: EntityType): string {
    if (entityType === "event") {
      return this.config.eventsDirectoryPath;
    } else if (entityType === "attribute") {
      return this.config.attributesDirectoryPath;
    } else if (entityType === "destination") {
      return this.config.destinationsDirectoryPath;
    } else if (entityType === "state") {
      return this.config.statesDirectoryPath;
    } else if (entityType === "effect") {
      return this.config.effectsDirectoryPath;
    } else if (entityType === "test") {
      return this.config.testsDirectoryPath;
    }

    throw new Error(`Unknown entity type: ${entityType}`);
  }

  getEntityPath(entityType: EntityType, entityKey: string): string {
    const basePath = this.getEntityDirectoryPath(entityType);

    // taking care of windows paths
    const relativeEntityPath = entityKey.replace(/\//g, path.sep);

    return path.join(basePath, `${relativeEntityPath}.${this.parser.extension}`);
  }

  async listEntities(entityType: EntityType): Promise<string[]> {
    const directoryPath = this.getEntityDirectoryPath(entityType);
    const filePaths = getAllEntityFilePathsRecursively(directoryPath, this.parser.extension);

    return (
      filePaths
        // keep only the files with the right extension
        .filter((filterPath) => filterPath.endsWith(`.${this.parser.extension}`))

        // remove the entity directory path from beginning
        .map((filePath) => filePath.replace(directoryPath + path.sep, ""))

        // remove the extension from the end
        .map((filterPath) => filterPath.replace(`.${this.parser.extension}`, ""))

        // take care of windows paths
        .map((filterPath) => filterPath.replace(/\\/g, "/"))
    );
  }

  async entityExists(entityType: EntityType, entityKey: string): Promise<boolean> {
    const entityPath = this.getEntityPath(entityType, entityKey);

    return fs.existsSync(entityPath);
  }

  async readEntity<T>(entityType: EntityType, entityKey: string): Promise<T> {
    const filePath = this.getEntityPath(entityType, entityKey);
    const entityContent = fs.readFileSync(filePath, "utf8");

    return this.parser.parse<T>(entityContent, filePath);
  }

  async writeEntity<T>(entityType: EntityType, entityKey: string, entity: T): Promise<T> {
    const filePath = this.getEntityPath(entityType, entityKey);

    if (!fs.existsSync(this.getEntityDirectoryPath(entityType))) {
      fs.mkdirSync(this.getEntityDirectoryPath(entityType), { recursive: true });
    }

    fs.writeFileSync(filePath, this.parser.stringify(entity));

    return entity;
  }

  async deleteEntity(entityType: EntityType, entityKey: string): Promise<void> {
    const filePath = this.getEntityPath(entityType, entityKey);

    if (!fs.existsSync(filePath)) {
      return;
    }

    fs.unlinkSync(filePath);
  }

  /**
   * Revision
   */
  async readRevision(): Promise<string> {
    const filePath = getRevisionFilePath(this.config);

    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, "utf8");
    }

    // maintain backwards compatibility
    try {
      const pkg = require(path.join(this.rootDirectoryPath as string, "package.json"));
      const pkgVersion = pkg.version;

      if (pkgVersion) {
        return pkgVersion;
      }

      return "0";
      // eslint-disable-next-line
    } catch (e) {
      return "0";
    }
  }

  async writeRevision(revision: string): Promise<void> {
    const filePath = getRevisionFilePath(this.config);

    if (!fs.existsSync(this.config.systemDirectoryPath)) {
      fs.mkdirSync(this.config.systemDirectoryPath, { recursive: true });
    }

    fs.writeFileSync(filePath, revision);
  }

  /**
   * Datafile
   */
  getDatafilePath(options: DatafileOptions): string {
    const pattern = this.config.datafileNamePattern || "eventvisor-%s.json";

    const fileName = pattern.replace("%s", `tag-${options.tag}`);
    const dir = options.datafilesDir || this.config.datafilesDirectoryPath;

    return path.join(dir, fileName);
  }

  async readDatafile(options: DatafileOptions): Promise<DatafileContent> {
    const filePath = this.getDatafilePath(options);
    const content = fs.readFileSync(filePath, "utf8");
    const datafileContent = JSON.parse(content);

    return datafileContent;
  }

  async writeDatafile(datafileContent: DatafileContent, options: DatafileOptions): Promise<void> {
    const dir = options.datafilesDir || this.config.datafilesDirectoryPath;

    const outputEnvironmentDirPath = dir;
    fs.mkdirSync(outputEnvironmentDirPath, { recursive: true });

    const outputFilePath = this.getDatafilePath(options);

    fs.writeFileSync(
      outputFilePath,
      this.config.prettyDatafile
        ? JSON.stringify(datafileContent, null, 2)
        : JSON.stringify(datafileContent),
    );

    const root = path.resolve(dir, "..");

    const shortPath = outputFilePath.replace(root + path.sep, "");
    console.log(`     Datafile generated: ${shortPath}`);
  }

  /**
   * History
   */
  async getRawHistory(pathPatterns: string[]): Promise<string> {
    const gitPaths = pathPatterns.join(" ");

    const logCommand = `git log --name-only --pretty=format:"%h|%an|%aI" --relative --no-merges -- ${gitPaths}`;
    const fullCommand = `(cd ${this.rootDirectoryPath} && ${logCommand})`;

    return new Promise(function (resolve, reject) {
      const child = spawn(fullCommand, { shell: true });
      let result = "";

      child.stdout.on("data", function (data) {
        result += data.toString();
      });

      child.stderr.on("data", function (data) {
        console.error(data.toString());
      });

      child.on("close", function (code) {
        if (code === 0) {
          resolve(result);
        } else {
          reject(code);
        }
      });
    });
  }

  getPathPatterns(entityType?: EntityType, entityKey?: string): string[] {
    let pathPatterns: string[] = [];

    if (entityType && entityKey) {
      pathPatterns = [this.getEntityPath(entityType, entityKey)];
    } else if (entityType) {
      if (entityType === "attribute") {
        pathPatterns = [this.config.attributesDirectoryPath];
      } else if (entityType === "event") {
        pathPatterns = [this.config.eventsDirectoryPath];
      } else if (entityType === "destination") {
        pathPatterns = [this.config.destinationsDirectoryPath];
      } else if (entityType === "effect") {
        pathPatterns = [this.config.effectsDirectoryPath];
      } else if (entityType === "test") {
        pathPatterns = [this.config.testsDirectoryPath];
      }
    } else {
      pathPatterns = [
        this.config.eventsDirectoryPath,
        this.config.attributesDirectoryPath,
        this.config.destinationsDirectoryPath,
        this.config.effectsDirectoryPath,
        this.config.testsDirectoryPath,
      ];
    }

    return pathPatterns.map((p) => p.replace((this.rootDirectoryPath as string) + path.sep, ""));
  }

  async listHistoryEntries(entityType?: EntityType, entityKey?: string): Promise<HistoryEntry[]> {
    const pathPatterns = this.getPathPatterns(entityType, entityKey);
    const rawHistory = await this.getRawHistory(pathPatterns);

    const fullHistory: HistoryEntry[] = [];
    const blocks = rawHistory.split("\n\n");

    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];

      if (block.length === 0) {
        continue;
      }

      const lines = block.split("\n");

      const commitLine = lines[0];
      const [commitHash, author, timestamp] = commitLine.split("|");

      const entities: HistoryEntity[] = [];

      const filePathLines = lines.slice(1);
      for (let j = 0; j < filePathLines.length; j++) {
        const relativePath = filePathLines[j];
        const absolutePath = path.join(this.rootDirectoryPath as string, relativePath);
        const fileName = absolutePath.split(path.sep).pop() as string;
        const relativeDir = path.dirname(absolutePath);

        const key = fileName.replace("." + this.parser.extension, "");

        let type: EntityType = "attribute";
        if (relativeDir === this.config.attributesDirectoryPath) {
          type = "attribute";
        } else if (relativeDir === this.config.eventsDirectoryPath) {
          type = "event";
        } else if (relativeDir === this.config.destinationsDirectoryPath) {
          type = "destination";
        } else if (relativeDir === this.config.effectsDirectoryPath) {
          type = "effect";
        } else if (relativeDir === this.config.testsDirectoryPath) {
          type = "test";
        } else {
          continue;
        }

        entities.push({
          type,
          key,
        });
      }

      if (entities.length === 0) {
        continue;
      }

      fullHistory.push({
        commit: commitHash,
        author,
        timestamp,
        entities,
      });
    }

    return fullHistory;
  }

  async readCommit(
    commitHash: string,
    entityType?: EntityType,
    entityKey?: string,
  ): Promise<Commit> {
    const pathPatterns = this.getPathPatterns(entityType, entityKey);
    const gitPaths = pathPatterns.join(" ");
    const logCommand = `git show ${commitHash} --relative -- ${gitPaths}`;
    const fullCommand = `(cd ${this.rootDirectoryPath} && ${logCommand})`;

    const gitShowOutput = execSync(fullCommand, { encoding: "utf8" }).toString();
    const commit = getCommit(gitShowOutput, {
      rootDirectoryPath: this.rootDirectoryPath as string,
      projectConfig: this.config,
    });

    return commit;
  }
}
