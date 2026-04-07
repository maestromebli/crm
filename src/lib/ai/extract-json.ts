/** Витягує перший JSON-об'єкт з відповіді моделі (може бути обгорнутий у ```json). */
export function extractFirstJsonObject(raw: string): unknown {
  const t = raw.trim();
  const fenced = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1]?.trim() ?? t;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start < 0 || end <= start) {
    throw new Error("JSON_NOT_FOUND");
  }
  return JSON.parse(candidate.slice(start, end + 1)) as unknown;
}
