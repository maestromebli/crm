/** Читає тіло відповіді як текст і парсить JSON — без «Unexpected end of JSON input» на порожньому тілі. */
export async function parseJsonResponse<T>(r: Response): Promise<T> {
  const text = await r.text();
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error(
      `Порожня відповідь сервера (HTTP ${r.status}). Спробуйте оновити сторінку.`,
    );
  }
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    const preview = trimmed.replace(/\s+/g, " ").slice(0, 160);
    throw new Error(
      r.ok
        ? `Сервер повернув не JSON: ${preview}`
        : `Помилка ${r.status}: ${preview}`,
    );
  }
}
