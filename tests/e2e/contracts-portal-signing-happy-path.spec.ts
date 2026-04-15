import { expect, test } from "@playwright/test";

test("contracts portal: happy path for view and signing session start", async ({
  page,
}) => {
  test.skip(
    !process.env.SCREENSHOT_CONTRACT_PORTAL_TOKEN,
    "Потрібен SCREENSHOT_CONTRACT_PORTAL_TOKEN для перевірки happy-path порталу контрактів",
  );

  const token = process.env.SCREENSHOT_CONTRACT_PORTAL_TOKEN!;

  const pageResponse = await page.goto(`/portal/contracts/${token}`);
  expect(pageResponse?.ok()).toBeTruthy();
  await expect(page.getByRole("heading", { name: /Договір №/ })).toBeVisible({
    timeout: 20_000,
  });

  const viewResponse = await page.request.get(`/api/portal/contracts/${token}`);
  expect(viewResponse.ok()).toBeTruthy();
  const viewJson = (await viewResponse.json()) as {
    ok?: boolean;
    data?: {
      contract?: { id?: string; status?: string };
      share?: { status?: string };
    };
    error?: string;
  };
  expect(viewJson.ok, viewJson.error ?? "Не вдалося отримати дані порталу контракту").toBe(
    true,
  );
  expect(viewJson.data?.contract?.id).toBeTruthy();
  expect(viewJson.data?.share?.status).toBe("ACTIVE");

  const viewedResponse = await page.request.post(
    `/api/portal/contracts/${token}/viewed`,
  );
  expect(viewedResponse.ok()).toBeTruthy();
  const viewedJson = (await viewedResponse.json()) as {
    ok?: boolean;
    error?: string;
  };
  expect(
    viewedJson.ok,
    viewedJson.error ?? "Не вдалося зафіксувати перегляд контракту в порталі",
  ).toBe(true);

  const signResponse = await page.request.post(`/api/portal/contracts/${token}/sign`);
  expect(signResponse.ok()).toBeTruthy();
  const signJson = (await signResponse.json()) as {
    ok?: boolean;
    data?: { sessionId?: string; signingUrl?: string; provider?: string };
    error?: string;
  };
  expect(signJson.ok, signJson.error ?? "Не вдалося ініціювати підписання в порталі").toBe(
    true,
  );
  expect(signJson.data?.sessionId).toBeTruthy();
  expect(signJson.data?.signingUrl).toBeTruthy();
  expect(["mock", "diia"]).toContain(signJson.data?.provider);
});
