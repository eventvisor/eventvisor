import * as path from "path";

const names = ["--rootDirectoryPath", "--root-directory-path", "--projectDirectoryPath"];

export function resolveRootDirectoryPath(argv: string[], fallback: string) {
  for (let index = 0; index < argv.length; index++) {
    const argument = argv[index];
    for (const name of names) {
      if (argument === name) {
        if (!argv[index + 1]) throw new Error(`${name} requires a path.`);
        return path.resolve(argv[index + 1]);
      }
      if (argument.startsWith(`${name}=`)) {
        const value = argument.slice(name.length + 1);
        if (!value) throw new Error(`${name} requires a path.`);
        return path.resolve(value);
      }
    }
  }
  return fallback;
}
