import type { ImportedBlock, ImportedRow } from "../types/calculationImport.types";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function rowExpectedAmount(row: ImportedRow): number | null {
  if (row.qty == null || row.price == null) return null;
  return round2(row.qty * (row.coeff ?? 1) * row.price);
}

export function validateCalculation(block: ImportedBlock): string[] {
  const warnings: string[] = [];

  for (const row of [...block.items, ...block.extras]) {
    if (!row.name.trim()) warnings.push(`Порожня назва в рядку ${row.sourceRow}`);
    if ((row.qty ?? 0) < 0 || (row.coeff ?? 0) < 0 || (row.price ?? 0) < 0) {
      warnings.push(`Негативне значення в рядку ${row.sourceRow}`);
    }
    const expected = rowExpectedAmount(row);
    if (expected != null && row.amount != null && Math.abs(expected - row.amount) > 0.2) {
      warnings.push(
        `Невідповідність формули в рядку ${row.sourceRow}: очікувано ${expected}, отримано ${row.amount}`,
      );
    }
  }

  const subtotalCalculated = round2(
    block.items.reduce((acc, row) => acc + (row.amount ?? 0), 0),
  );
  if (
    block.subtotal?.amount != null &&
    Math.abs(subtotalCalculated - block.subtotal.amount) > 0.5
  ) {
    warnings.push(
      `Subtotal mismatch: ${subtotalCalculated} vs ${block.subtotal.amount}`,
    );
  }

  const extrasSum = round2(block.extras.reduce((acc, row) => acc + (row.amount ?? 0), 0));
  const finalCalculated = round2(subtotalCalculated + extrasSum);
  if (
    block.finalTotal?.amount != null &&
    Math.abs(finalCalculated - block.finalTotal.amount) > 0.5
  ) {
    warnings.push(`Final total mismatch: ${finalCalculated} vs ${block.finalTotal.amount}`);
  }

  if (block.items.length === 0) {
    warnings.push("Після нормалізації блок не містить рядків");
  }

  return warnings;
}
