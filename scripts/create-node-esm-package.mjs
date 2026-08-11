import { writeFileSync } from "node:fs";
import path from "node:path";
import { cwd } from "node:process";

writeFileSync(
  path.join(cwd(), "node-esm", "package.json"),
  `${JSON.stringify({ type: "module" }, null, 2)}\n`,
);
