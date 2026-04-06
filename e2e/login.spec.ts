import { expect, test } from "@playwright/test";

test.describe("Login (magic link UI)", () => {
  test("email form is present", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: /fjell lift/i })).toBeVisible();
    await expect(page.getByRole("textbox", { name: /email/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /send magic link/i })).toBeVisible();
  });
});
