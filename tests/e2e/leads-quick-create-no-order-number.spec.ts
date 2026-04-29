import { expect, test } from "@playwright/test";

test("lead quick create works without order number", async ({ page }) => {
  const email = process.env.SCREENSHOT_EMAIL;
  const password = process.env.SCREENSHOT_PASSWORD;
  test.skip(
    !email || !password,
    "Set SCREENSHOT_EMAIL and SCREENSHOT_PASSWORD to run authenticated lead flow smoke",
  );
  const stamp = Date.now();

  await page.goto("/login");
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole("button", { name: /увійти|вхід|login/i }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), {
    timeout: 30_000,
  });

  const createLeadResponse = await page.request.post("/api/leads", {
    data: {
      title: `Quick Lead No Order ${stamp}`,
      contactName: "Quick Create",
      phone: `+38050${String(stamp).slice(-7)}`,
      source: "e2e-quick-create",
      priority: "normal",
      // Intentionally omitted orderNumber to verify ENVER Sales OS flow.
    },
  });
  const createLeadJson = (await createLeadResponse.json()) as {
    id?: string;
    error?: string;
  };
  expect(
    createLeadResponse.ok(),
    createLeadJson.error ?? "Failed to create lead without order number",
  ).toBeTruthy();
  expect(createLeadJson.id).toBeTruthy();
});
