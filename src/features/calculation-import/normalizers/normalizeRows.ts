import type { ImportedRow } from "../types/calculationImport.types";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function normalizeRows(rows: ImportedRow[]): ImportedRow[] {
  return rows
    .map((row) => {
      const name = row.name.replace(/\s+/g, " ").trim();
      const qty = row.qty != null && Number.isFinite(row.qty) ? row.qty : null;
      const coeff =
        row.coeff != null && Number.isFinite(row.coeff) ? row.coeff : null;
      const price =
        row.price != null && Number.isFinite(row.price) ? row.price : null;

      const computed =
        qty != null && price != null ? round2(qty * (coeff ?? 1) * price) : null;
      const amount =
        row.amount != null && Number.isFinite(row.amount)
          ? round2(row.amount)
          : computed;

      return {
        ...row,
        name,
        qty,
        coeff,
        price,
        amount,
      };
    })
    .filter((row) => row.name.length > 0);
}
