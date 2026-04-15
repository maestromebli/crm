import type * as XLSX from "xlsx";
import { buildSheetMatrix } from "./detectBlocks";
import type {
  AmountRow,
  ColumnMap,
  DetectedBlock,
  ImportedBlock,
  ImportedRow,
  ParsedCell,
} from "../types/calculationImport.types";

const ALIASES = {
  name: [/найменув/i, /назва/i, /позиц/i],
  qty: [/кіл/i, /к-ть/i, /qty/i],
  coeff: [/коеф/i, /coef/i],
  price: [/ціна/i, /цена/i, /price/i],
  amount: [/сума/i, /сумма/i, /итого/i, /разом/i, /amount/i],
};

function normalize(s: string): string {
  return s.replace(/\s+/g, " ").trim().toLowerCase();
}

function parseNumber(s: string): number | null {
  const raw = s.replace(/\s+/g, "").replace(",", ".").replace(/[^\d.-]/g, "");
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function classifyName(name: string): ImportedRow["type"] {
  const n = normalize(name);
  if (/(дсп|мдф)/i.test(n)) return "material";
  if (/(направляюч|петл)/i.test(n)) return "fitting";
  if (/(доставк)/i.test(n)) return "service";
  if (/(замір)/i.test(n)) return "measurement";
  return "misc";
}

function findCol(row: ParsedCell[], patterns: RegExp[], fallback: number): number {
  for (let c = 0; c < row.length; c += 1) {
    const text = normalize(row[c]?.text ?? "");
    if (!text) continue;
    if (patterns.some((p) => p.test(text))) return c;
  }
  return fallback;
}

function buildHeaderMap(row: ParsedCell[]): ColumnMap {
  const nameCol = findCol(row, ALIASES.name, 0);
  const qtyCol = findCol(row, ALIASES.qty, Math.min(nameCol + 1, row.length - 1));
  const coeffCol = findCol(row, ALIASES.coeff, Math.min(qtyCol + 1, row.length - 1));
  const priceCol = findCol(row, ALIASES.price, Math.min(coeffCol + 1, row.length - 1));
  const amountCol = findCol(row, ALIASES.amount, Math.min(priceCol + 1, row.length - 1));
  return { nameCol, qtyCol, coeffCol, priceCol, amountCol };
}

function parseAmountRow(label: string, amountCell: ParsedCell): AmountRow {
  return {
    label: label.trim(),
    amount: amountCell.numeric ?? parseNumber(amountCell.text),
    formula: amountCell.formula,
  };
}

export function parseBlock(sheet: XLSX.WorkSheet, detected: DetectedBlock): ImportedBlock {
  const matrix = buildSheetMatrix(sheet);
  const headerCells = matrix[detected.headerRow] ?? [];
  const headerMap = buildHeaderMap(headerCells);

  const titleCells = matrix[detected.titleRow] ?? [];
  const titleText = titleCells.map((c) => c.text).find((t) => t.trim().length > 0);
  const productName = titleText?.trim() || `Продукт ${detected.id}`;

  const items: ImportedRow[] = [];
  const extras: ImportedRow[] = [];
  let subtotal: AmountRow | undefined;
  let finalTotal: AmountRow | undefined;
  const warnings: string[] = [];

  for (let r = detected.headerRow + 1; r <= detected.endRow; r += 1) {
    const row = matrix[r] ?? [];
    const nameCell = row[headerMap.nameCol];
    const qtyCell = row[headerMap.qtyCol];
    const coeffCell = row[headerMap.coeffCol];
    const priceCell = row[headerMap.priceCol];
    const amountCell = row[headerMap.amountCol];

    const name = (nameCell?.text ?? "").trim();
    if (!name) continue;
    const nName = normalize(name);

    if (nName.includes("загальна собівартість")) {
      subtotal = parseAmountRow(name, amountCell ?? { text: "", numeric: null });
      continue;
    }
    if (nName.includes("загальна вартість")) {
      finalTotal = parseAmountRow(name, amountCell ?? { text: "", numeric: null });
      continue;
    }

    const qty = qtyCell?.numeric ?? parseNumber(qtyCell?.text ?? "");
    const coeff = coeffCell?.numeric ?? parseNumber(coeffCell?.text ?? "");
    const price = priceCell?.numeric ?? parseNumber(priceCell?.text ?? "");
    const parsedAmount = amountCell?.numeric ?? parseNumber(amountCell?.text ?? "");
    const computedAmount =
      qty != null && price != null ? qty * (coeff ?? 1) * price : null;
    const amount = parsedAmount ?? computedAmount;

    const line: ImportedRow = {
      id: `${detected.id}-r${r + 1}`,
      name,
      type: classifyName(name),
      qty,
      coeff,
      price,
      amount,
      formula: amountCell?.formula,
      sourceRow: r + 1,
    };

    if (line.type === "measurement") {
      extras.push(line);
    } else {
      items.push(line);
    }
  }

  if (items.length === 0) {
    warnings.push("Не знайдено валідних позицій у блоці");
  }
  if (!finalTotal) {
    warnings.push("Не знайдено рядок «Загальна ВАРТІСТЬ»");
  }

  return {
    id: detected.id,
    productName,
    headerMap,
    items,
    subtotal,
    extras,
    finalTotal,
    warnings,
  };
}
