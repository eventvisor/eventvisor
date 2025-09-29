import * as fs from "fs";
import * as path from "path";

import { CONFIG_MODULE_NAME, getProjectConfig, Datasource, runCLI } from "@eventvisor/core";

process.on("unhandledRejection", (reason) => {
  console.error(reason);
  process.exit(1);
});

async function main() {
  const rootDirectoryPath = process.cwd();
  const argv = process.argv.slice(2);

  if (argv.length === 1 && ["version", "--version", "-v"].indexOf(argv[0]) > -1) {
    const cliPackage = JSON.parse(
      fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf8"),
    );

    const corePackage = JSON.parse(
      fs.readFileSync(require.resolve("@eventvisor/core/package.json"), "utf8"),
    );

    console.log("\nPackage versions:\n");
    console.log(`  - @eventvisor/cli:  ${cliPackage.version}`);
    console.log(`  - @eventvisor/core: ${corePackage.version}`);

    return;
  }

  let useRootDirectoryPath = rootDirectoryPath;
  const customRootDir = argv.filter((arg) => arg.startsWith("--rootDirectoryPath="));
  if (customRootDir.length > 0) {
    useRootDirectoryPath = customRootDir[0].split("=")[1];
  }

  const configModulePath = path.join(rootDirectoryPath, CONFIG_MODULE_NAME);
  if (!fs.existsSync(configModulePath)) {
    // not an existing project
    await runCLI({ rootDirectoryPath: useRootDirectoryPath });
  } else {
    // existing project
    const projectConfig = getProjectConfig(useRootDirectoryPath);
    const datasource = new Datasource(projectConfig, useRootDirectoryPath);

    await runCLI({
      rootDirectoryPath: useRootDirectoryPath,
      projectConfig,
      datasource,
    });
  }
}

main();
