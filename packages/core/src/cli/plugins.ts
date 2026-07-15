import type { Plugin } from "./cli";

import { configPlugin } from "../config";
import { lintPlugin } from "../linter";
import { buildPlugin } from "../builder";
import { testPlugin } from "../tester";
import { initPlugin } from "../init";
import { catalogPlugin } from "../catalog";
import { generateCodePlugin } from "../generate-code";
import { listPlugin } from "../list";
import { infoPlugin } from "../info";
import { findUsagePlugin } from "../find-usage";
import { simulatePlugin } from "../simulate";
import { benchmarkPlugin } from "../benchmark";

export const commonPlugins: Plugin[] = [];

export const nonProjectPlugins: Plugin[] = [initPlugin];

export const projectBasedPlugins: Plugin[] = [
  configPlugin,
  lintPlugin,
  buildPlugin,
  testPlugin,
  catalogPlugin,
  generateCodePlugin,
  listPlugin,
  infoPlugin,
  findUsagePlugin,
  simulatePlugin,
  benchmarkPlugin,
];
