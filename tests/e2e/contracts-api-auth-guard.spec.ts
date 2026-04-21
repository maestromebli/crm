import { expect, test } from "@playwright/test";

test("contracts API blocks unauthenticated access", async ({ request }) => {
  const missingId = "00000000-0000-0000-0000-000000000000";

  const listResponse = await request.get("/api/contracts");
  expect(listResponse.status()).toBe(401);

  const readResponse = await request.get(`/api/contracts/${missingId}`);
  expect(readResponse.status()).toBe(401);

  const updateResponse = await request.patch(`/api/contracts/${missingId}`, {
    data: { payloadJson: { foo: "bar" } },
  });
  expect(updateResponse.status()).toBe(401);
});

test("contract templates API blocks unauthenticated access", async ({ request }) => {
  const missingId = "00000000-0000-0000-0000-000000000000";

  const listResponse = await request.get("/api/contract-templates");
  expect(listResponse.status()).toBe(401);

  const readResponse = await request.get(`/api/contract-templates/${missingId}`);
  expect(readResponse.status()).toBe(401);

  const previewResponse = await request.post("/api/contract-templates/preview", {
    data: { bodyHtml: "<p>Тест</p>", payloadJson: {} },
  });
  expect(previewResponse.status()).toBe(401);
});
