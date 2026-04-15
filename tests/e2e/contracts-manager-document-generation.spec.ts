import { expect, test } from "@playwright/test";

test("contracts manager API generates contract and specification documents", async ({
  browser,
  page,
}) => {
  test.setTimeout(300_000);

  test.skip(
    !process.env.SCREENSHOT_CONTRACT_PORTAL_TOKEN ||
      !process.env.SCREENSHOT_EMAIL ||
      !process.env.SCREENSHOT_PASSWORD,
    "Потрібні SCREENSHOT_CONTRACT_PORTAL_TOKEN, SCREENSHOT_EMAIL і SCREENSHOT_PASSWORD",
  );

  const token = process.env.SCREENSHOT_CONTRACT_PORTAL_TOKEN!;
  const email = process.env.SCREENSHOT_EMAIL!;
  const password = process.env.SCREENSHOT_PASSWORD!;

  const portalResponse = await page.request.get(`/api/portal/contracts/${token}`);
  expect(portalResponse.ok()).toBeTruthy();
  const portalJson = (await portalResponse.json()) as {
    ok?: boolean;
    data?: { contract?: { id?: string } };
    error?: string;
  };
  expect(
    portalJson.ok,
    portalJson.error ?? "Не вдалося отримати контракт порталу для генерації документів",
  ).toBe(true);
  const contractId = portalJson.data?.contract?.id;
  expect(contractId).toBeTruthy();

  const managerContext = await browser.newContext();
  try {
    const managerPage = await managerContext.newPage();
    await managerPage.goto("/login");
    await managerPage.locator('input[name="email"]').fill(email);
    await managerPage.locator('input[name="password"]').fill(password);
    await managerPage.getByRole("button", { name: /увійти|вхід|login/i }).click();
    await managerPage.waitForURL((url) => !url.pathname.startsWith("/login"), {
      timeout: 60_000,
    });

    const getContract = async () => {
      const response = await managerContext.request.get(`/api/contracts/${contractId}`);
      if (!response.ok()) {
        return {
          ok: false,
          docs: [] as Array<{ type?: string; fileUrl?: string }>,
          error: `HTTP_${response.status()}`,
        };
      }
      const body = (await response.json()) as {
        ok?: boolean;
        data?: {
          documents?: Array<{ type?: string; fileUrl?: string }>;
        };
        error?: string;
      };
      return {
        ok: body.ok === true,
        docs: body.data?.documents ?? [],
        error: body.error ?? null,
      };
    };

    const before = await getContract();
    expect(before.ok, before.error ?? "Не вдалося отримати контракт до генерації документів").toBe(
      true,
    );
    const beforeCount = before.docs.length;

    const generateResponse = await managerContext.request.post(
      `/api/contracts/${contractId}/generate-documents`,
    );
    expect(generateResponse.ok()).toBeTruthy();
    const generateJson = (await generateResponse.json()) as {
      ok?: boolean;
      data?: { contractPdfUrl?: string; specificationPdfUrl?: string };
      error?: string;
    };
    expect(
      generateJson.ok,
      generateJson.error ?? "Не вдалося згенерувати документи контракту",
    ).toBe(true);
    expect(generateJson.data?.contractPdfUrl).toBeTruthy();
    expect(generateJson.data?.specificationPdfUrl).toBeTruthy();

    await expect
      .poll(
        async () => {
          const state = await getContract();
          return state.ok ? state.docs.length : -1;
        },
        {
          timeout: 20_000,
          intervals: [500, 1_000, 2_000, 2_000, 3_000],
        },
      )
      .toBeGreaterThanOrEqual(beforeCount + 2);

    const after = await getContract();
    expect(after.ok, after.error ?? "Не вдалося отримати контракт після генерації документів").toBe(
      true,
    );
    const types = after.docs.map((doc) => doc.type ?? "");
    expect(types.includes("CONTRACT")).toBeTruthy();
    expect(types.includes("SPEC")).toBeTruthy();
  } finally {
    await managerContext.close();
  }
});
