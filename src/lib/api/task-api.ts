import { parseResponseJson } from "./parse-response-json";

export async function patchTaskById(
  taskId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const r = await fetch(`/api/tasks/${taskId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  const j = await parseResponseJson<{ error?: string; message?: string }>(r);
  if (!r.ok) throw new Error(j.error ?? j.message ?? "Не вдалося оновити задачу");
}
