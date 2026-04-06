import { expect, test } from "@playwright/test";

test.describe("Map access control", () => {
  test("lets unauthenticated users open the map (public areas only)", async ({ page }) => {
    await page.goto("/map");
    await expect(page).toHaveURL(/\/map/);
    await expect(page.getByRole("heading", { name: "Sport" })).toBeVisible();
  });
});
