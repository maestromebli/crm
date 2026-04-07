import { patchJson } from "./patch-json";

export async function patchTaskById(
  taskId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  await patchJson<Record<string, unknown>>(`/api/tasks/${taskId}`, patch);
}
