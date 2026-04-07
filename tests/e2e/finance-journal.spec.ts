/**
 * Журнал проводок: логін і POST збалансованої проводки.
 * Запуск: pnpm exec playwright test tests/e2e/finance-journal.spec.ts
 * (потрібен dev-сервер і БД з таблицями журналу, як у migrate deploy.)
 */
import { test, expect } from "@playwright/test";

test.describe("Finance journal", () => {
  test("POST balanced entry via UI", async ({ page }) => {
    const email = process.env.SCREENSHOT_EMAIL ?? "admin@enver.com";
    const password = process.env.SCREENSHOT_PASSWORD ?? "admin123";

    await page.goto("/login");
    await page.locator('input[name="email"]').fill(email);
    await page.locator('input[name="password"]').fill(password);
    await page.getByRole("button", { name: /увійти/i }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 45_000 });

    await page.goto("/crm/finance/journal");
    await expect(page.getByRole("heading", { name: /Нова проводка/i })).toBeVisible({
      timeout: 45_000,
    });

    const formTable = page.locator("section").first().locator("table tbody");
    const row0 = formTable.locator("tr").nth(0);
    const row1 = formTable.locator("tr").nth(1);

    await row0.locator("select").first().selectOption({ index: 1 });
    await row1.locator("select").first().selectOption({ index: 2 });

    await row0.locator("td").nth(1).locator("input").fill("1000");
    await row1.locator("td").nth(2).locator("input").fill("1000");

    const postPromise = page.waitForResponse(
      (res) =>
        res.url().includes("/api/crm/finance/journal-entries") &&
        res.request().method() === "POST",
      { timeout: 30_000 },
    );
    await page.getByRole("button", { name: /Зберегти проводку/i }).click();
    const postRes = await postPromise;
    expect(postRes.ok(), await postRes.text()).toBeTruthy();
    const body = (await postRes.json()) as { entry?: { id?: string } };
    expect(body.entry?.id, "POST має повернути entry.id").toBeTruthy();

    await expect(page.getByRole("heading", { name: /Останні проводки/i })).toBeVisible();
    await expect(page.locator("section").nth(1).getByText("POSTED", { exact: true }).first()).toBeVisible({
      timeout: 15_000,
    });
  });
});
