/**
 * `response.json()` кидає «Unexpected end of JSON input», якщо тіло порожнє
 * (деякі проксі, 204, або обрив з'єднання). Читаємо текст і парсимо вручну.
 */
export async function parseResponseJson<T extends object>(
  r: Response,
): Promise<T> {
  const text = await r.text();
  if (!text.trim()) {
    return {} as T;
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    return {} as T;
  }
}

type ApiErrorBody = {
  error?: string;
  message?: string;
};

/** Повідомлення для UI з тіла відповіді або HTTP-статусу. */
export function getApiErrorMessage(
  r: Response,
  body: ApiErrorBody | null | undefined,
  fallback: string,
): string {
  const msg = body?.error ?? body?.message;
  if (msg && String(msg).trim()) return String(msg).trim();
  if (r.statusText?.trim()) {
    return `${fallback} (${r.status} ${r.statusText})`;
  }
  return `${fallback} (HTTP ${r.status})`;
}
