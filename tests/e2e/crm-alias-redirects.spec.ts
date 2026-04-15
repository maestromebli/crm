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

test("crm aliases redirect to canonical routes with query preserved", async ({
  page,
}) => {
  await signIn(page);

  await page.goto("/crm/leads/test-lead-1?tab=messages&fromLead=1", {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  await page.waitForURL(/\/leads\/test-lead-1\?/, { timeout: 30_000 });
  await expect(page).toHaveURL(/\/leads\/test-lead-1\?tab=messages&fromLead=1/);

  await page.goto("/crm/deals/test-deal-1/workspace?tab=finance&fromLead=1", {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  await page.waitForURL(/\/deals\/test-deal-1\/workspace\?/, { timeout: 30_000 });
  await expect(page).toHaveURL(
    /\/deals\/test-deal-1\/workspace\?tab=finance&fromLead=1/,
  );

  await page.goto("/crm/deal/test-deal-2?tab=tasks&source=alias", {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  await page.waitForURL(/\/deals\/test-deal-2\/workspace\?/, { timeout: 30_000 });
  await expect(page).toHaveURL(
    /\/deals\/test-deal-2\/workspace\?tab=tasks&source=alias/,
  );
});
