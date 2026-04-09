import { test, expect } from "@playwright/test";

test("intro page loads", async ({ page }) => {
  await page.goto("/");
  const title = page.locator("#title");
  await expect(title).toContainText("BLACKHOLE");
});

test("auth page renders google button", async ({ page }) => {
  await page.goto("/auth");
  await expect(page.locator("#google-btn")).toBeAttached();
});
