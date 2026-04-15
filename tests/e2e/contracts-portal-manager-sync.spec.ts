import { expect, test } from "@playwright/test";

test("contracts portal actions are reflected in manager contracts API", async ({
  browser,
  page,
}) => {
  test.skip(
    !process.env.SCREENSHOT_CONTRACT_PORTAL_TOKEN ||
      !process.env.SCREENSHOT_EMAIL ||
      !process.env.SCREENSHOT_PASSWORD,
    "Потрібні SCREENSHOT_CONTRACT_PORTAL_TOKEN, SCREENSHOT_EMAIL і SCREENSHOT_PASSWORD",
  );

  const token = process.env.SCREENSHOT_CONTRACT_PORTAL_TOKEN!;
  const email = process.env.SCREENSHOT_EMAIL!;
  const password = process.env.SCREENSHOT_PASSWORD!;

  const portalBeforeResponse = await page.request.get(`/api/portal/contracts/${token}`);
  expect(portalBeforeResponse.ok()).toBeTruthy();
  const portalBeforeJson = (await portalBeforeResponse.json()) as {
    ok?: boolean;
    data?: {
      contract?: { id?: string };
    };
    error?: string;
  };
  expect(
    portalBeforeJson.ok,
    portalBeforeJson.error ?? "Не вдалося отримати контракт порталу",
  ).toBe(true);
  const contractId = portalBeforeJson.data?.contract?.id;
  expect(contractId).toBeTruthy();

  const viewedResponse = await page.request.post(`/api/portal/contracts/${token}/viewed`);
  expect(viewedResponse.ok()).toBeTruthy();
  const signResponse = await page.request.post(`/api/portal/contracts/${token}/sign`);
  expect(signResponse.ok()).toBeTruthy();

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

    const fetchManagerContract = async () => {
      const response = await managerContext.request.get(`/api/contracts/${contractId}`);
      if (!response.ok()) {
        return {
          ok: false,
          status: "",
          auditActions: [] as string[],
          error: `HTTP_${response.status()}`,
        };
      }
      const body = (await response.json()) as {
        ok?: boolean;
        data?: {
          status?: string;
          audit?: Array<{
            action?: string;
            payload?: { action?: string };
          }>;
        };
        error?: string;
      };
      return {
        ok: body.ok === true,
        status: body.data?.status ?? "",
        auditActions: (body.data?.audit ?? [])
          .map((item) => item.payload?.action ?? item.action ?? "")
          .filter(Boolean),
        error: body.error ?? null,
      };
    };

    await expect
      .poll(fetchManagerContract, {
        timeout: 20_000,
        intervals: [500, 1_000, 2_000, 2_000, 3_000],
      })
      .toMatchObject({
        ok: true,
        status: "SENT_FOR_SIGNATURE",
      });

    const finalState = await fetchManagerContract();
    expect(
      finalState.ok,
      finalState.error ?? "Не вдалося отримати контракт у менеджерському API",
    ).toBe(true);
    expect(finalState.auditActions.includes("portal_viewed")).toBeTruthy();
    expect(finalState.auditActions.includes("portal_sign_start")).toBeTruthy();
  } finally {
    await managerContext.close();
  }
});
