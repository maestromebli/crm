import { expect, test } from "@playwright/test";

test("manager flow via pure UI: lead hub to deal", async ({ page }) => {
  test.setTimeout(360_000);

  const email = process.env.SCREENSHOT_EMAIL ?? "vera.blochytska@enver.local";
  const password = process.env.SCREENSHOT_PASSWORD ?? "vera123";

  await page.goto("/login");
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole("button", { name: /увійти|вхід|login/i }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), {
    timeout: 120_000,
  });

  await page.goto("/leads");
  const demoLead = page.getByRole("link", { name: /Demo Lead Hub Manager/i }).first();
  if ((await demoLead.count()) > 0) {
    await demoLead.click();
  } else {
    await page
      .locator('main table tbody tr a[href^="/leads/"]')
      .first()
      .click();
  }
  await page.waitForURL(/\/leads\/[^/]+(\?.*)?$/, { timeout: 45_000 });

  // Lead Hub readability / navigation check
  await expect(page.getByText("Як користуватись хабом")).toBeVisible();
  const showAllTabs = page.getByRole("button", { name: "Показати всі вкладки" });
  if (await showAllTabs.isVisible()) {
    await showAllTabs.click();
  }
  for (const tab of ["Комунікація", "Файли", "Замір", "Розрахунок", "КП", "Нотатки"]) {
    const t = page.getByRole("tab", { name: new RegExp(tab, "i") }).first();
    await t.click();
    await expect(t).toHaveAttribute("aria-selected", "true");
  }

  // Go to pricing from entity subnav
  await page.getByRole("link", { name: "Розрахунок" }).first().click();
  await page.waitForURL(/\/leads\/[^/]+\/pricing/, { timeout: 30_000 });

  const createEstimateButton = page.getByRole("button", {
    name: /Створити розрахунок/i,
  });
  if (await createEstimateButton.isVisible()) {
    await createEstimateButton.click();
  }

  // Create proposal from estimate
  const createProposalButton = page.getByRole("button", {
    name: /Створити КП з цієї смети/i,
  });
  await expect(createProposalButton).toBeVisible({ timeout: 45_000 });
  await createProposalButton.click();

  await expect(page.getByRole("dialog")).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: /^Створити КП$/ }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 30_000 });

  // Approve proposal in UI
  const approveButton = page.getByRole("button", {
    name: /Підтверджено клієнтом/i,
  });
  if (await approveButton.isVisible({ timeout: 20_000 })) {
    await approveButton.click();
  }

  // Back to hub and convert to deal via UI
  const leadUrl = page.url();
  const leadIdMatch = leadUrl.match(/\/leads\/([^/?#]+)/);
  expect(leadIdMatch?.[1]).toBeTruthy();
  const leadId = leadIdMatch![1];

  await page.goto(`/leads/${leadId}`);
  const convertButton = page.getByRole("button", { name: "В угоду" }).first();
  await expect(convertButton).toBeVisible({ timeout: 45_000 });
  await convertButton.click();

  const createDealButton = page.getByRole("button", { name: "Створити угоду" });
  await expect(createDealButton).toBeVisible({ timeout: 20_000 });
  const convertResponsePromise = page.waitForResponse(
    (response) =>
      response.url().includes(`/api/leads/${leadId}/convert-to-deal`) &&
      response.request().method() === "POST",
  );
  await createDealButton.click();
  const convertResponse = await convertResponsePromise;
  const convertJson = (await convertResponse.json()) as {
    dealId?: string;
    error?: string;
  };
  expect(
    convertResponse.ok(),
    convertJson.error ?? "Не вдалося створити угоду",
  ).toBeTruthy();
  expect(convertJson.dealId).toBeTruthy();

  await page.goto(`/deals/${convertJson.dealId}/workspace?fromLead=1`);
  await expect(page).toHaveURL(/\/deals\/.+\/workspace/);
});

