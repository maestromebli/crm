import { expect, test } from "@playwright/test";

test("lead hub notes: manager advances lead stage", async ({ page }) => {
  test.setTimeout(240_000);

  test.skip(
    !process.env.SCREENSHOT_EMAIL || !process.env.SCREENSHOT_PASSWORD,
    "Потрібні SCREENSHOT_EMAIL і SCREENSHOT_PASSWORD для e2e авторизації",
  );

  const email = process.env.SCREENSHOT_EMAIL!;
  const password = process.env.SCREENSHOT_PASSWORD!;
  const stamp = Date.now();
  const leadTitle = `Demo Notes Stage ${stamp}`;

  await page.goto("/login");
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole("button", { name: /увійти|вхід|login/i }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), {
    timeout: 60_000,
  });

  const createLeadResponse = await page.request.post("/api/leads", {
    data: {
      title: leadTitle,
      contactName: "Тест Нотатки",
      phone: `+38067${String(stamp).slice(-7)}`,
      source: "demo-notes-stage-flow",
      priority: "high",
      note: "E2E: перевірка переходу між етапами у вкладці Нотатки",
    },
  });

  const createLeadJson = (await createLeadResponse.json()) as {
    id?: string;
    error?: string;
  };
  expect(
    createLeadResponse.ok(),
    createLeadJson.error ?? "Не вдалося створити тестовий лід",
  ).toBeTruthy();
  const leadId = createLeadJson.id;
  expect(leadId).toBeTruthy();

  await page.goto(`/leads/${leadId}`);

  const showAllTabsButton = page.getByRole("button", {
    name: "Показати всі вкладки",
  });
  if (await showAllTabsButton.isVisible()) {
    await showAllTabsButton.click();
  }

  const notesTab = page.getByRole("tab", { name: "Нотатки" }).first();
  await notesTab.click();
  await expect(notesTab).toHaveAttribute("aria-selected", "true");

  const card = page.locator('[role="button"][aria-label*="Відкрити деталі ліда"]').first();
  await expect(card).toBeVisible({ timeout: 45_000 });
  await card.click();

  const detailPanelTitle = page.getByRole("heading", { name: /Demo Notes Stage/i }).first();
  await expect(detailPanelTitle).toBeVisible({ timeout: 30_000 });

  const advanceButton = page.getByRole("button", {
    name: "Перевести на наступний етап",
  });
  await expect(advanceButton).toBeEnabled();

  const patchPromise = page.waitForResponse(
    (response) =>
      response.url().includes(`/api/leads/${leadId}`) &&
      response.request().method() === "PATCH",
  );
  await advanceButton.click();
  const patchResponse = await patchPromise;
  const patchJson = (await patchResponse.json()) as { error?: string };
  expect(
    patchResponse.ok(),
    patchJson.error ?? "Не вдалося перевести лід на наступний етап",
  ).toBeTruthy();

  await expect(page.getByText("Статус оновлено").first()).toBeVisible({
    timeout: 20_000,
  });
});
