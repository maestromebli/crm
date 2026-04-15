import { expect, test } from "@playwright/test";

test("manager reviews lead hub and converts lead to deal", async ({ page }) => {
  test.setTimeout(300_000);
  const email =
    process.env.SCREENSHOT_EMAIL ?? "vera.blochytska@enver.local";
  const password = process.env.SCREENSHOT_PASSWORD ?? "vera123";
  const stamp = Date.now();
  const leadTitle = `Demo Lead Hub Manager ${stamp}`;

  await page.goto("/login");
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole("button", { name: /увійти|вхід|login/i }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), {
    timeout: 30_000,
  });

  const createLeadResponse = await page.request.post("/api/leads", {
    data: {
      title: leadTitle,
      contactName: "Тест Менеджер",
      phone: `+38050${String(stamp).slice(-7)}`,
      source: "demo-manager-flow",
      priority: "normal",
    },
  });
  const createLeadJson = (await createLeadResponse.json()) as {
    id?: string;
    error?: string;
  };
  expect(
    createLeadResponse.ok(),
    createLeadJson.error ?? "Failed to create demo lead",
  ).toBeTruthy();
  const leadId = createLeadJson.id;
  expect(leadId).toBeTruthy();

  await page.goto(`/leads/${leadId}`);
  await expect(page.getByText("Як користуватись хабом")).toBeVisible();

  const showAllTabsButton = page.getByRole("button", {
    name: "Показати всі вкладки",
  });
  if (await showAllTabsButton.isVisible()) {
    await showAllTabsButton.click();
  }

  for (const tabLabel of [
    "Комунікація",
    "Файли",
    "Замір",
    "Розрахунок",
    "КП",
    "Нотатки",
  ]) {
    const tab = page.getByRole("tab", { name: tabLabel });
    await tab.click();
    await expect(tab).toHaveAttribute("aria-selected", "true");
  }

  const stageSelect = page.locator("header select").first();
  await expect(stageSelect).toBeVisible();

  const stageOptions = await stageSelect.locator("option").evaluateAll((opts) =>
    opts.map((o) => ({
      value: (o as HTMLOptionElement).value,
      label: (o.textContent ?? "").trim(),
    })),
  );
  const currentStageId = await stageSelect.inputValue();

  const orderedNonFinalStageIds = stageOptions
    .filter((o) => !o.label.includes("фінал"))
    .map((o) => o.value);
  const currentNonFinalIndex = orderedNonFinalStageIds.indexOf(currentStageId);
  const stagesToWalk =
    currentNonFinalIndex >= 0
      ? orderedNonFinalStageIds.slice(currentNonFinalIndex + 1)
      : orderedNonFinalStageIds.filter((v) => v !== currentStageId);

  for (const stageId of stagesToWalk) {
    await stageSelect.selectOption(stageId);
    await expect(stageSelect).toHaveValue(stageId);
  }

  const estimateResponse = await page.request.post(
    `/api/leads/${leadId}/estimates`,
    {
      data: { templateKey: "kitchen" },
    },
  );
  const estimateJson = (await estimateResponse.json()) as {
    estimate?: { id?: string };
    error?: string;
  };
  expect(
    estimateResponse.ok(),
    estimateJson.error ?? "Failed to create estimate",
  ).toBeTruthy();
  const estimateId = estimateJson.estimate?.id;
  expect(estimateId).toBeTruthy();

  const proposalResponse = await page.request.post(
    `/api/leads/${leadId}/proposals`,
    {
      data: {
        estimateId,
        title: `КП для ${leadTitle}`,
      },
    },
  );
  const proposalJson = (await proposalResponse.json()) as {
    proposal?: { id?: string };
    error?: string;
  };
  expect(
    proposalResponse.ok(),
    proposalJson.error ?? "Failed to create proposal",
  ).toBeTruthy();
  const proposalId = proposalJson.proposal?.id;
  expect(proposalId).toBeTruthy();

  const approveResponse = await page.request.patch(
    `/api/leads/${leadId}/proposals/${proposalId}`,
    {
      data: { status: "APPROVED" },
    },
  );
  const approveJson = (await approveResponse.json()) as { error?: string };
  expect(
    approveResponse.ok(),
    approveJson.error ?? "Failed to approve proposal",
  ).toBeTruthy();

  await page.reload();
  const convertButton = page.getByRole("button", { name: "В угоду" }).first();
  await expect(convertButton).toBeVisible();
  await convertButton.click();

  const createDealButton = page.getByRole("button", { name: "Створити угоду" });
  await expect(createDealButton).toBeVisible();
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
    convertJson.error ?? "Failed to convert lead to deal",
  ).toBeTruthy();
  expect(convertJson.dealId).toBeTruthy();

  await page.goto(`/deals/${convertJson.dealId}/workspace?fromLead=1`);
  await expect(page).toHaveURL(/\/deals\/.+\/workspace/);
});
