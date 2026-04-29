import { expect, test } from "@playwright/test";

test("contracts portal API rate limits repeated invalid token checks", async ({
  request,
}) => {
  const token = `invalid-token-rate-limit-${Date.now()}`;
  const statuses: number[] = [];

  for (let i = 0; i < 75; i += 1) {
    const response = await request.get(`/api/portal/contracts/${token}`);
    statuses.push(response.status());
    if (response.status() === 429) {
      break;
    }
  }

  expect(statuses.some((status) => status === 429)).toBeTruthy();
});
