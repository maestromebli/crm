import { expect, test } from "@playwright/test";

test("lead API: viewer gets 403 on lead patch", async ({ browser }) => {
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
  const leadTitle = `Demo Notes RBAC API ${stamp}`;

  const managerContext = await browser.newContext();
  const managerPage = await managerContext.newPage();

  await managerPage.goto("/login");
  await managerPage.locator('input[name="email"]').fill(managerEmail);
  await managerPage.locator('input[name="password"]').fill(managerPassword);
  await managerPage.getByRole("button", { name: /увійти|вхід|login/i }).click();
  await managerPage.waitForURL((url) => !url.pathname.startsWith("/login"), {
    timeout: 60_000,
  });

  const createLeadResponse = await managerContext.request.post("/api/leads", {
    data: {
      title: leadTitle,
      contactName: "Тест RBAC API",
      phone: `+38095${String(stamp).slice(-7)}`,
      source: "demo-notes-rbac-api",
      priority: "normal",
      note: "E2E: серверна заборона PATCH для viewer",
    },
  });
  const createLeadJson = (await createLeadResponse.json()) as {
    id?: string;
    error?: string;
  };
  expect(
    createLeadResponse.ok(),
    createLeadJson.error ?? "Не вдалося створити тестовий лід для API RBAC",
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

  const patchResponse = await viewerContext.request.patch(`/api/leads/${leadId}`, {
    data: {
      note: "viewer should not be able to update this lead",
    },
  });
  const patchJson = (await patchResponse.json()) as { error?: string };

  expect(patchResponse.status()).toBe(403);
  expect((patchJson.error ?? "").length).toBeGreaterThan(0);

  await viewerContext.close();
});
