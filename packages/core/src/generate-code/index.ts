import * as fs from "fs";
import * as path from "path";

import { generateTypeScriptCodeForProject } from "./typescript";
import { Dependencies } from "../dependencies";
import { Plugin } from "../cli";
import { buildSelectedDatafile } from "../builder";
import { getProjectSetExecutions } from "../sets";
import { printSetHeader } from "../sets";
import { CLI_COLOR_CYAN, CLI_FORMAT_BOLD, colorize } from "../tester/cliFormat";

export const ALLOWED_LANGUAGES_FOR_CODE_GENERATION = ["typescript"];

export interface GenerateCodeCLIOptions {
  language: string;
  outDir: string;
  tag?: string | string[];
  target?: string | string[];
  set?: string;
  // @TODO: react?: boolean;
}

export async function generateCodeForProject(
  deps: Dependencies,
  cliOptions: GenerateCodeCLIOptions,
) {
  const { rootDirectoryPath } = deps;

  if (!cliOptions.language) {
    throw new Error("Option `--language` is required");
  }

  if (!cliOptions.outDir) {
    throw new Error("Option `--out-dir` is required");
  }

  const absolutePath = path.resolve(rootDirectoryPath, cliOptions.outDir);

  if (!fs.existsSync(absolutePath)) {
    console.log(`Creating output directory: ${colorize(absolutePath, CLI_COLOR_CYAN)}`);
    fs.mkdirSync(absolutePath, { recursive: true });
  }

  if (!ALLOWED_LANGUAGES_FOR_CODE_GENERATION.includes(cliOptions.language)) {
    console.log(
      `Only these languages are supported: ${ALLOWED_LANGUAGES_FOR_CODE_GENERATION.join(", ")}`,
    );

    throw new Error(`Language ${cliOptions.language} is not supported for code generation`);
  }

  if (cliOptions.language === "typescript") {
    const hasSelection = cliOptions.tag || cliOptions.target;
    const selectedDatafile = hasSelection
      ? await buildSelectedDatafile(deps, { tag: cliOptions.tag, target: cliOptions.target })
      : undefined;
    return await generateTypeScriptCodeForProject(deps, absolutePath, selectedDatafile);
  }

  throw new Error(`Language ${cliOptions.language} is not supported`);
}

export const generateCodePlugin: Plugin = {
  command: "generate-code",
  description: "generate typed project code",
  options: {
    language: { type: "string", demandOption: true },
    outDir: { type: "string", demandOption: true },
    tag: { type: "array", description: "include entities matching a tag; repeatable" },
    target: { type: "array", description: "include entities matching a target; repeatable" },
    set: { type: "string" },
  },
  handler: async function ({ rootDirectoryPath, projectConfig, datasource, parsed }) {
    try {
      const executions = await getProjectSetExecutions(projectConfig, datasource, parsed.set);
      for (const execution of executions) {
        printSetHeader(projectConfig, execution.set);
        console.log(CLI_FORMAT_BOLD, "Generating Eventvisor code");
        await generateCodeForProject(
          {
            rootDirectoryPath,
            projectConfig: execution.projectConfig,
            datasource: execution.datasource,
            options: parsed,
          },
          {
            language: parsed.language,
            outDir:
              projectConfig.sets && !parsed.set
                ? `${parsed.outDir}/${execution.set}`
                : parsed.outDir,
            tag: parsed.tag,
            target: parsed.target,
            set: parsed.set,
          },
        );
      }
    } catch (error) {
      console.error(error.message);

      return false;
    }
  },
  examples: [
    {
      command: "generate-code --language typescript --out-dir src/generated",
      description: "Generate TypeScript code for the project",
    },
  ],
};
