import { expect, test } from "@playwright/test";

test("contracts portal: status and share counters transition correctly", async ({
  page,
}) => {
  test.skip(
    !process.env.SCREENSHOT_CONTRACT_PORTAL_TOKEN,
    "Потрібен SCREENSHOT_CONTRACT_PORTAL_TOKEN для перевірки переходів стану в порталі контрактів",
  );

  const token = process.env.SCREENSHOT_CONTRACT_PORTAL_TOKEN!;

  const beforeResponse = await page.request.get(`/api/portal/contracts/${token}`);
  expect(beforeResponse.ok()).toBeTruthy();
  const beforeJson = (await beforeResponse.json()) as {
    ok?: boolean;
    data?: {
      contract?: { id?: string; status?: string };
      share?: { viewCount?: number; status?: string };
    };
    error?: string;
  };
  expect(beforeJson.ok, beforeJson.error ?? "Не вдалося отримати початковий стан порталу").toBe(
    true,
  );
  const beforeViews = beforeJson.data?.share?.viewCount ?? 0;
  expect(beforeJson.data?.share?.status).toBe("ACTIVE");
  expect(beforeJson.data?.contract?.id).toBeTruthy();

  const viewedResponse = await page.request.post(
    `/api/portal/contracts/${token}/viewed`,
  );
  expect(viewedResponse.ok()).toBeTruthy();
  const viewedJson = (await viewedResponse.json()) as { ok?: boolean; error?: string };
  expect(
    viewedJson.ok,
    viewedJson.error ?? "Не вдалося зафіксувати перегляд контракту",
  ).toBe(true);

  const afterViewedResponse = await page.request.get(`/api/portal/contracts/${token}`);
  expect(afterViewedResponse.ok()).toBeTruthy();
  const afterViewedJson = (await afterViewedResponse.json()) as {
    ok?: boolean;
    data?: {
      contract?: { status?: string };
      share?: { viewCount?: number };
    };
    error?: string;
  };
  expect(
    afterViewedJson.ok,
    afterViewedJson.error ?? "Не вдалося перевірити стан після перегляду",
  ).toBe(true);
  expect((afterViewedJson.data?.share?.viewCount ?? 0) >= beforeViews + 1).toBeTruthy();
  expect(afterViewedJson.data?.contract?.status).toBe("VIEWED_BY_CLIENT");

  const signResponse = await page.request.post(`/api/portal/contracts/${token}/sign`);
  expect(signResponse.ok()).toBeTruthy();
  const signJson = (await signResponse.json()) as {
    ok?: boolean;
    data?: { sessionId?: string; provider?: string; signingUrl?: string };
    error?: string;
  };
  expect(signJson.ok, signJson.error ?? "Не вдалося ініціювати підписання").toBe(true);
  expect(signJson.data?.sessionId).toBeTruthy();
  expect(signJson.data?.signingUrl).toBeTruthy();
  expect(["mock", "diia"]).toContain(signJson.data?.provider);

  const afterSignResponse = await page.request.get(`/api/portal/contracts/${token}`);
  expect(afterSignResponse.ok()).toBeTruthy();
  const afterSignJson = (await afterSignResponse.json()) as {
    ok?: boolean;
    data?: { contract?: { status?: string } };
    error?: string;
  };
  expect(afterSignJson.ok, afterSignJson.error ?? "Не вдалося перевірити стан після sign").toBe(
    true,
  );
  expect(afterSignJson.data?.contract?.status).toBe("SENT_FOR_SIGNATURE");
});
