/** Цифри для порівняння телефонів (дублі між лідами / контактами). */
export function normalizePhoneDigits(input: string | null | undefined): string {
  if (!input?.trim()) return "";
  return input.replace(/\D/g, "");
}

/** Порівняння за останніми 9–12 цифрами (UA / міжнародний формат). */
export function phonesLikelySame(a: string, b: string): boolean {
  const da = normalizePhoneDigits(a);
  const db = normalizePhoneDigits(b);
  if (!da || !db) return false;
  const tail = (d: string) => d.slice(-Math.min(12, d.length));
  const ta = tail(da);
  const tb = tail(db);
  return ta === tb || ta.endsWith(tb) || tb.endsWith(ta);
}
