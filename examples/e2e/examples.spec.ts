import { expect, test } from "@playwright/test";

test("React example initializes and tracks interactions", async ({ page }) => {
  await page.goto("http://127.0.0.1:4181");
  await expect(page.getByRole("heading", { name: "Hello World" })).toBeVisible();
  const counter = page.getByRole("button", { name: "Counter: 0" });
  await counter.click();
  await expect(page.getByRole("button", { name: "Counter: 1" })).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => Boolean((window as any).eventvisor?.isReady())))
    .toBe(true);
});

test("vanilla example initializes and responds", async ({ page }) => {
  await page.goto("http://127.0.0.1:4182");
  await expect(page.getByRole("heading", { name: "Hello World!" })).toBeVisible();
  const counter = page.getByRole("button", { name: "count is 0" });
  await counter.click();
  await expect(page.getByRole("button", { name: "count is 1" })).toBeVisible();
});
