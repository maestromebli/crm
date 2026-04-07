/** Посилання на файл у хмарі з публічної сторінки конструктора (без javascript:, data: тощо). */
export function isAllowedPublicConstructorFileUrl(raw: string): boolean {
  const s = raw.trim();
  if (!s || s.length > 12_000) return false;
  try {
    const u = new URL(s);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}
