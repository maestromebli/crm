import { expect, test } from "@playwright/test";

const inboxRoutes = [
  "/inbox",
  "/inbox/unread",
  "/inbox/unanswered",
  "/inbox/overdue",
  "/inbox/mine",
  "/inbox/unlinked",
  "/inbox/telegram",
];

test("inbox unlinked filter stays clickable", async ({ page }) => {
  const email = process.env.SCREENSHOT_EMAIL ?? "admin@enver.com";
  const password = process.env.SCREENSHOT_PASSWORD ?? "admin123";

  await page.goto("/login");
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole("button", { name: /увійти/i }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 90_000 });

  for (const route of inboxRoutes) {
    await page.goto(route, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await expect(page).toHaveURL(new RegExp(route.replace("/", "\\/")));
    const unlinkedFilter = page
      .locator("button")
      .filter({ hasText: /Без\s*зв.?язку\s*з\s*CRM/i })
      .first();
    await expect(unlinkedFilter).toBeVisible({ timeout: 20_000 });
    await unlinkedFilter.scrollIntoViewIfNeeded();
    await unlinkedFilter.click({ timeout: 10_000 });
  }
});
