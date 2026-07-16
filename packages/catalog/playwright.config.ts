import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://127.0.0.1:4174",
    channel: process.env.CI ? undefined : "chrome",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "node scripts/dev.mjs --port=4174 --no-open",
    url: "http://127.0.0.1:4174/data/manifest.json",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
