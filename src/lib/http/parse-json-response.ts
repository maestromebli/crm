type ParseJsonResponseOptions = {
  /**
   * Назва сервісу для дружнього тексту помилки:
   * "Сервер <serviceLabel> тимчасово недоступний..."
   */
  serviceLabel?: string;
};

/** Читає тіло як текст і безпечно парсить JSON. Дає дружні повідомлення для HTTP-помилок. */
export async function parseJsonResponse<T>(
  r: Response,
  options?: ParseJsonResponseOptions,
): Promise<T> {
  const text = await r.text();
  const trimmed = text.trim();
  const servicePrefix = options?.serviceLabel ? `Сервер ${options.serviceLabel}` : "Сервер";
  if (!trimmed) {
    if (!r.ok) {
      throw new Error(
        `${servicePrefix} тимчасово недоступний (HTTP ${r.status}). Спробуйте пізніше.`,
      );
    }
    throw new Error(`Порожня відповідь сервера (HTTP ${r.status}). Спробуйте оновити сторінку.`);
  }
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    const preview = trimmed.replace(/\s+/g, " ").slice(0, 160);
    throw new Error(
      r.ok
        ? `Сервер повернув не JSON: ${preview}`
        : `${servicePrefix}: помилка HTTP ${r.status}. ${preview}`,
    );
  }
}
