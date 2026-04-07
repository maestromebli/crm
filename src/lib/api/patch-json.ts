import { parseResponseJson } from "./parse-response-json";

export async function patchJson<T>(
  url: string,
  body: Record<string, unknown>,
  init?: { credentials?: RequestCredentials },
): Promise<T> {
  const r = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    ...(init?.credentials ? { credentials: init.credentials } : {}),
  });
  const j = await parseResponseJson<T & { error?: string; message?: string }>(r);
  if (!r.ok) throw new Error(j.error ?? j.message ?? "Помилка");
  return j as T;
}
