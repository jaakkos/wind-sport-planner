import { expect, test } from "@playwright/test";

test.describe("Marketing home", () => {
  test("loads and shows sign-in entry point", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /fjell lift/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /sign in/i })).toBeVisible();
  });
});
