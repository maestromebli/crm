import { expect, test } from "@playwright/test";

test("contracts portal: invalid token is rejected by APIs and page returns 404", async ({
  page,
}) => {
  const token = `invalid-token-${Date.now()}`;

  const apiViewResponse = await page.request.get(`/api/portal/contracts/${token}`);
  expect(apiViewResponse.status()).toBe(404);
  await expect
    .soft((await apiViewResponse.json()) as { error?: string })
    .toMatchObject({ error: "Посилання не знайдено" });

  const apiViewedResponse = await page.request.post(
    `/api/portal/contracts/${token}/viewed`,
  );
  expect(apiViewedResponse.status()).toBe(404);
  await expect
    .soft((await apiViewedResponse.json()) as { error?: string })
    .toMatchObject({ error: "Посилання не знайдено" });

  const apiSignResponse = await page.request.post(
    `/api/portal/contracts/${token}/sign`,
  );
  expect(apiSignResponse.status()).toBe(404);
  await expect
    .soft((await apiSignResponse.json()) as { error?: string })
    .toMatchObject({ error: "Посилання не знайдено" });

  const pageResponse = await page.goto(`/portal/contracts/${token}`);
  expect(pageResponse?.status()).toBe(404);
});
