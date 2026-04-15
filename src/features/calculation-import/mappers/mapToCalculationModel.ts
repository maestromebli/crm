import { encodeCategoryKey, lineTypeForCategory, type EstimateCategoryKey } from "@/lib/estimates/estimate-categories";
import type { DraftLine } from "@/lib/estimates/ai-estimate-draft";
import type { ImportedWorkbook, ImportedRow } from "../types/calculationImport.types";

function mapTypeToCategory(type: ImportedRow["type"]): EstimateCategoryKey {
  if (type === "material") return "cabinets";
  if (type === "fitting") return "fittings";
  if (type === "service") return "installation";
  if (type === "measurement") return "installation";
  return "extras";
}

function toDraftLine(row: ImportedRow, productNamePrefix?: string): DraftLine | null {
  const name = row.name.trim();
  if (!name) return null;
  const categoryKey = mapTypeToCategory(row.type);
  const qty = row.qty ?? 0;
  const salePrice = row.price ?? 0;
  const amountSale =
    row.amount ??
    (qty > 0 && salePrice > 0 ? qty * (row.coeff ?? 1) * salePrice : 0);

  return {
    type: lineTypeForCategory(categoryKey),
    category: encodeCategoryKey(categoryKey),
    categoryKey,
    productName: productNamePrefix ? `${productNamePrefix}: ${name}` : name,
    qty,
    unit: "шт",
    salePrice,
    amountSale,
  };
}

export function mapImportedWorkbookToDraftLines(workbook: ImportedWorkbook): {
  lines: DraftLine[];
  assumptions: string[];
  missing: string[];
} {
  const lines: DraftLine[] = [];
  const assumptions: string[] = [
    `Імпорт Excel: ${workbook.fileName}`,
    `Аркушів: ${workbook.sheets.length}`,
  ];
  const missing: string[] = [];

  for (const sheet of workbook.sheets) {
    assumptions.push(`Аркуш ${sheet.name}: блоків ${sheet.blocks.length}`);
    for (const block of sheet.blocks) {
      for (const row of block.items) {
        const mapped = toDraftLine(row, block.productName);
        if (mapped) lines.push(mapped);
      }
      for (const extra of block.extras) {
        const mapped = toDraftLine(extra, block.productName);
        if (mapped) lines.push(mapped);
      }
      if (block.warnings.length > 0) {
        assumptions.push(`${block.productName}: ${block.warnings.join("; ")}`);
      }
    }
  }

  if (lines.length === 0) {
    missing.push("Не знайдено валідних рядків для імпорту");
  }

  return { lines, assumptions, missing };
}
