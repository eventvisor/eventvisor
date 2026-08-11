import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    channel: process.env.CI ? undefined : "chrome",
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: "npm run dev -- --host 127.0.0.1 --port 4181",
      cwd: "example-react",
      url: "http://127.0.0.1:4181",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: "npm run dev -- --host 127.0.0.1 --port 4182",
      cwd: "example-vanilla",
      url: "http://127.0.0.1:4182",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
