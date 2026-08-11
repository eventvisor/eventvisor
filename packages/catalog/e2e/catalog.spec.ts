import { expect, test } from "@playwright/test";
import * as fs from "node:fs";
import * as path from "node:path";

test("browses lists, namespaced entities, tests, and transforms", async ({ page }) => {
  await page.goto("/events");
  await expect(page.getByRole("heading", { name: "Events" })).toBeVisible();
  await expect(page.getByRole("link", { name: /banner_click/ })).toBeVisible();

  await page.goto("/events/auth%252Fsignup");
  await expect(page.getByRole("heading", { name: "auth/signup" })).toBeVisible();
  await expect(page.getByRole("link", { name: "View source" })).toBeVisible();

  await page.goto("/events/banner_click/tests");
  await expect(page.getByText("Assertion 1.1", { exact: true })).toBeVisible();
  await expect(page.getByTitle("Link to this assertion").first()).toBeVisible();

  await page.goto("/events/transform_showcase/transforms");
  await expect(page.getByRole("heading", { name: "Transforms", exact: true })).toBeVisible();
  await expect(page.getByText("Step 01", { exact: true })).toBeVisible();

  await page.setViewportSize({ width: 375, height: 800 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});

test("reloads generated data after a project definition changes", async ({ page }) => {
  const eventPath = path.resolve(process.cwd(), "../../projects/project-1/events/page_view.yml");
  const original = fs.readFileSync(eventPath, "utf8");
  const marker = `Live reload ${Date.now()}`;
  try {
    await page.goto("/events/page_view");
    fs.writeFileSync(eventPath, original.replace(/description:.*/, `description: ${marker}`));
    await expect(page.getByText(marker)).toBeVisible({ timeout: 15_000 });
  } finally {
    fs.writeFileSync(eventPath, original);
  }
});
