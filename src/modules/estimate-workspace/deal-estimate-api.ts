import { parseResponseJson } from "../../lib/api/parse-response-json";

export async function patchDealEstimateById<T>(
  dealId: string,
  estimateId: string,
  body: Record<string, unknown>,
): Promise<T> {
  const r = await fetch(`/api/deals/${dealId}/estimates/${estimateId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const j = await parseResponseJson<T & { error?: string; message?: string }>(r);
  if (!r.ok) throw new Error(j.error ?? j.message ?? "Помилка");
  return j as T;
}
