import { useMemo } from "react";
import type { ImportedBlock, ImportedRow } from "./types/calculationImport.types";

export type CalculationImportAiHint = {
  id: string;
  blockId: string;
  severity: "info" | "warning";
  message: string;
};

function suspiciousRow(row: ImportedRow): string | null {
  if (!row.name.trim()) return "Рядок без назви";
  if (row.amount == null && row.qty != null && row.price != null) {
    return "Відсутня сума, але є кількість і ціна";
  }
  if (row.qty == null || row.price == null) {
    return "Неповні дані (кількість або ціна)";
  }
  if (row.qty < 0 || row.price < 0) return "Негативні значення";
  return null;
}

export function useCalculationImportAI(blocks: ImportedBlock[]) {
  const hints = useMemo<CalculationImportAiHint[]>(() => {
    const out: CalculationImportAiHint[] = [];
    for (const block of blocks) {
      for (const row of [...block.items, ...block.extras]) {
        const issue = suspiciousRow(row);
        if (issue) {
          out.push({
            id: `${block.id}-${row.id}`,
            blockId: block.id,
            severity: "warning",
            message: `${issue}: "${row.name || `рядок ${row.sourceRow}`}"`,
          });
        }
      }
      if (block.items.length > 12) {
        out.push({
          id: `${block.id}-grouping`,
          blockId: block.id,
          severity: "info",
          message: "Рекомендація: згрупувати рядки за типами (матеріали/фурнітура/послуги).",
        });
      }
    }
    return out;
  }, [blocks]);

  return { hints };
}
