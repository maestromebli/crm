/** UTF-8 BOM для коректного відкриття в Excel (Windows). */
export const CSV_UTF8_BOM = "\uFEFF";

/** Роздільник полів для Excel у локалі UA. */
export const CSV_SEP = ";";

export function escapeCsvCell(value: string | number | null | undefined): string {
  const t = value === null || value === undefined ? "" : String(value);
  if (/[",;\n\r]/.test(t)) return `"${t.replace(/"/g, '""')}"`;
  return t;
}

export function csvRow(cells: (string | number | null | undefined)[]): string {
  return cells.map(escapeCsvCell).join(CSV_SEP);
}
