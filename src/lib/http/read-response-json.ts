/**
 * Безпечний розбір JSON з fetch Response.
 * Типова помилка `Unexpected end of JSON input` виникає при порожньому тілі (502, 204, редірект без JSON).
 */
export async function readResponseJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!text.trim()) {
    throw new Error(`Порожня відповідь сервера (HTTP ${res.status})`);
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`Некоректний JSON у відповіді (HTTP ${res.status})`);
  }
}

/** Повертає null при порожньому тілі або невалідному JSON (без throw). */
export async function tryReadResponseJson<T>(res: Response): Promise<T | null> {
  const text = await res.text();
  if (!text.trim()) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}
