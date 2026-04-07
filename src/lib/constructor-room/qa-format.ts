/** Нормалізація рядка Q&A з JSON (різні ключі від AI / ручного вводу). */
export function qaRowParts(row: unknown): { question: string; answer: string } {
  const o = row as {
    question?: string;
    answer?: string;
    q?: string;
    a?: string;
  };
  return {
    question: String(o.question ?? o.q ?? "").trim(),
    answer: String(o.answer ?? o.a ?? "").trim(),
  };
}
