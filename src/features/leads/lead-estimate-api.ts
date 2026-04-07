import { parseResponseJson } from "@/lib/api/parse-response-json";

export async function patchLeadEstimateById<T>(
  leadId: string,
  estimateId: string,
  body: Record<string, unknown>,
): Promise<T> {
  const r = await fetch(`/api/leads/${leadId}/estimates/${estimateId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const j = await parseResponseJson<(T & { error?: string }) | { error?: string }>(r);
  if (!r.ok) {
    const msg =
      typeof j === "object" &&
      j !== null &&
      "error" in j &&
      typeof j.error === "string"
        ? j.error
        : "Помилка";
    throw new Error(msg);
  }
  return j as T;
}
