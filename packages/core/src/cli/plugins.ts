import type { Plugin } from "./cli";

import { configPlugin } from "../config";
import { lintPlugin } from "../linter";
import { buildPlugin } from "../builder";
import { testPlugin } from "../tester";
import { initPlugin } from "../init";
import { catalogPlugin } from "../catalog";
import { generateCodePlugin } from "../generate-code";

export const commonPlugins: Plugin[] = [];

export const nonProjectPlugins: Plugin[] = [initPlugin];

export const projectBasedPlugins: Plugin[] = [
  configPlugin,
  lintPlugin,
  buildPlugin,
  testPlugin,
  catalogPlugin,
  generateCodePlugin,
];
