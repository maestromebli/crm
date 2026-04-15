import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

async function signIn(page: Page) {
  const email = process.env.SCREENSHOT_EMAIL ?? "admin@enver.com";
  const password = process.env.SCREENSHOT_PASSWORD ?? "admin123";
  await page.goto("/login");
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole("button", { name: /увійти/i }).click();
  await page.waitForURL(/\/(crm\/dashboard|dashboard)/, { timeout: 90_000 });
}

test("production mini-hq shows project tree and operator panel", async ({ page }) => {
  await signIn(page);
  await page.goto("/crm/production/workshop", {
    waitUntil: "domcontentloaded",
    timeout: 90_000,
  });
  await expect(page.getByText("Проєкт / дерево")).toBeVisible();
  await expect(page.getByText("Панель оператора")).toBeVisible();
  await expect(page.getByText("GitLab sync")).toBeVisible();
});

