/**
 * One-click finance workflow: verifies API call and response shape.
 * Запуск: pnpm exec playwright test tests/e2e/deal-financial-workflow.spec.ts
 * Потрібні ENV: SCREENSHOT_EMAIL, SCREENSHOT_PASSWORD, E2E_DEAL_ID
 */
import { test, expect } from "@playwright/test";

test.describe("Deal financial workflow", () => {
  test("runs one-click finance flow from workspace header", async ({ page }) => {
    const dealId = process.env.E2E_DEAL_ID;
    test.skip(!dealId, "E2E_DEAL_ID is required for this spec");

    const email = process.env.SCREENSHOT_EMAIL ?? "admin@enver.com";
    const password = process.env.SCREENSHOT_PASSWORD ?? "admin123";

    await page.goto("/login");
    await page.locator('input[name="email"]').fill(email);
    await page.locator('input[name="password"]').fill(password);
    await page.getByRole("button", { name: /увійти/i }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 45_000 });

    await page.goto(`/deals/${dealId}/workspace`);
    await expect(page.getByRole("button", { name: /Фінанси в один клік/i })).toBeVisible({
      timeout: 45_000,
    });

    const responsePromise = page.waitForResponse(
      (res) =>
        res.request().method() === "POST" &&
        res.url().includes(`/api/deals/${dealId}/financial-workflow`),
      { timeout: 45_000 },
    );
    await page.getByRole("button", { name: /Фінанси в один клік/i }).click();
    const response = await responsePromise;
    expect(response.ok(), await response.text()).toBeTruthy();
    const payload = (await response.json()) as {
      summary?: { success?: number; failed?: number; skipped?: number };
      steps?: Array<{ key?: string; status?: string; message?: string }>;
    };
    expect(payload.summary, "summary is required").toBeTruthy();
    expect(Array.isArray(payload.steps), "steps must be array").toBeTruthy();
    expect(payload.steps?.length ?? 0, "steps must not be empty").toBeGreaterThan(0);
  });
});
