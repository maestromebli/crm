import { expect, test } from "@playwright/test";

test("lead hub notes: stage transition is disabled without update permission", async ({
  browser,
}) => {
  test.setTimeout(300_000);

  test.skip(
    !process.env.SCREENSHOT_EMAIL ||
      !process.env.SCREENSHOT_PASSWORD ||
      !process.env.SCREENSHOT_VIEWER_EMAIL ||
      !process.env.SCREENSHOT_VIEWER_PASSWORD,
    "Потрібні SCREENSHOT_EMAIL/SCREENSHOT_PASSWORD та SCREENSHOT_VIEWER_EMAIL/SCREENSHOT_VIEWER_PASSWORD",
  );

  const managerEmail = process.env.SCREENSHOT_EMAIL!;
  const managerPassword = process.env.SCREENSHOT_PASSWORD!;
  const viewerEmail = process.env.SCREENSHOT_VIEWER_EMAIL!;
  const viewerPassword = process.env.SCREENSHOT_VIEWER_PASSWORD!;

  const stamp = Date.now();
  const leadTitle = `Demo Notes RBAC ${stamp}`;

  const managerContext = await browser.newContext();
  const managerPage = await managerContext.newPage();

  await managerPage.goto("/login");
  await managerPage.locator('input[name="email"]').fill(managerEmail);
  await managerPage.locator('input[name="password"]').fill(managerPassword);
  await managerPage.getByRole("button", { name: /увійти|вхід|login/i }).click();
  await managerPage.waitForURL((url) => !url.pathname.startsWith("/login"), {
    timeout: 60_000,
  });

  const createLeadResponse = await managerPage.request.post("/api/leads", {
    data: {
      title: leadTitle,
      contactName: "Тест RBAC",
      phone: `+38096${String(stamp).slice(-7)}`,
      source: "demo-notes-rbac",
      priority: "normal",
      note: "E2E: перевірка блокування зміни етапу без прав",
    },
  });
  const createLeadJson = (await createLeadResponse.json()) as {
    id?: string;
    error?: string;
  };
  expect(
    createLeadResponse.ok(),
    createLeadJson.error ?? "Не вдалося створити тестовий лід для RBAC",
  ).toBeTruthy();
  const leadId = createLeadJson.id;
  expect(leadId).toBeTruthy();
  await managerContext.close();

  const viewerContext = await browser.newContext();
  const viewerPage = await viewerContext.newPage();

  await viewerPage.goto("/login");
  await viewerPage.locator('input[name="email"]').fill(viewerEmail);
  await viewerPage.locator('input[name="password"]').fill(viewerPassword);
  await viewerPage.getByRole("button", { name: /увійти|вхід|login/i }).click();
  await viewerPage.waitForURL((url) => !url.pathname.startsWith("/login"), {
    timeout: 60_000,
  });

  await viewerPage.goto(`/leads/${leadId}`);

  const showAllTabsButton = viewerPage.getByRole("button", {
    name: "Показати всі вкладки",
  });
  if (await showAllTabsButton.isVisible()) {
    await showAllTabsButton.click();
  }

  const notesTab = viewerPage.getByRole("tab", { name: "Нотатки" }).first();
  await notesTab.click();
  await expect(notesTab).toHaveAttribute("aria-selected", "true");

  const card = viewerPage
    .locator('[role="button"][aria-label*="Відкрити деталі ліда"]')
    .first();
  await expect(card).toBeVisible({ timeout: 45_000 });
  await card.click();

  const advanceButton = viewerPage.getByRole("button", {
    name: "Перевести на наступний етап",
  });
  await expect(advanceButton).toBeVisible({ timeout: 30_000 });
  await expect(advanceButton).toBeDisabled();

  await viewerContext.close();
});
