import * as XLSX from "xlsx";
import type { DetectedBlock, ParsedCell, SheetMatrix } from "../types/calculationImport.types";

const HEADER_ALIASES = {
  name: [/найменув/i, /назва/i, /позиці/i],
  qty: [/кіл/i, /к-ть/i, /кол-?во/i, /qty/i],
  coeff: [/коеф/i, /\bкоэф/i, /\bcoef/i],
  price: [/ціна/i, /цена/i, /\bprice/i],
  amount: [/сума/i, /сумма/i, /разом/i, /итого/i, /\bamount/i, /\bsum\b/i],
};

function normalizeText(input: string): string {
  return input
    .replace(/\s+/g, " ")
    .replace(/[’']/g, "'")
    .trim()
    .toLowerCase();
}

function parseNumberish(v: string): number | null {
  const raw = v.replace(/\s+/g, "").replace(",", ".").replace(/[^\d.-]/g, "");
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function matchAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((p) => p.test(text));
}

export function buildSheetMatrix(sheet: XLSX.WorkSheet): SheetMatrix {
  const ref = sheet["!ref"];
  if (!ref) return [];
  const range = XLSX.utils.decode_range(ref);
  const rows: SheetMatrix = [];

  for (let r = range.s.r; r <= range.e.r; r += 1) {
    const row: ParsedCell[] = [];
    for (let c = range.s.c; c <= range.e.c; c += 1) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const cell = sheet[addr];
      const text = cell?.w != null ? String(cell.w) : cell?.v != null ? String(cell.v) : "";
      row.push({
        text: text.trim(),
        formula: typeof cell?.f === "string" ? cell.f : undefined,
        numeric: parseNumberish(text),
      });
    }
    rows.push(row);
  }

  const merges = sheet["!merges"] ?? [];
  for (const merge of merges) {
    const sr = merge.s.r - range.s.r;
    const sc = merge.s.c - range.s.c;
    const er = merge.e.r - range.s.r;
    const ec = merge.e.c - range.s.c;
    if (sr < 0 || sc < 0 || er >= rows.length || !rows[sr]?.[sc]) continue;
    const seed = rows[sr][sc];
    for (let r = sr; r <= er; r += 1) {
      for (let c = sc; c <= ec; c += 1) {
        if (!rows[r]?.[c]) continue;
        if (!rows[r][c].text) {
          rows[r][c] = { ...seed };
        }
      }
    }
  }

  return rows;
}

function isHeaderRow(row: ParsedCell[]): boolean {
  const cells = row.map((c) => normalizeText(c.text)).filter(Boolean);
  if (cells.length === 0) return false;
  const hasName = cells.some((t) => matchAny(t, HEADER_ALIASES.name));
  const hasQty = cells.some((t) => matchAny(t, HEADER_ALIASES.qty));
  const hasCoeff = cells.some((t) => matchAny(t, HEADER_ALIASES.coeff));
  const hasPrice = cells.some((t) => matchAny(t, HEADER_ALIASES.price));
  const hasAmount = cells.some((t) => matchAny(t, HEADER_ALIASES.amount));
  const score = [hasName, hasQty, hasCoeff, hasPrice, hasAmount].filter(Boolean).length;
  return score >= 4;
}

function looksLikeTitleRow(row: ParsedCell[]): boolean {
  const nonEmpty = row.filter((c) => c.text.trim().length > 0);
  if (nonEmpty.length === 0) return false;
  const numericCells = nonEmpty.filter((c) => c.numeric != null).length;
  if (numericCells > 0) return false;
  const longTexts = nonEmpty.filter((c) => c.text.trim().length >= 4);
  if (longTexts.length === 0) return false;
  if (isHeaderRow(row)) return false;
  const text = normalizeText(nonEmpty.map((c) => c.text).join(" "));
  if (text.includes("загальна вартість") || text.includes("загальна собівартість")) {
    return false;
  }
  return true;
}

function isFinalTotalRow(row: ParsedCell[]): boolean {
  const txt = normalizeText(row.map((c) => c.text).join(" "));
  return txt.includes("загальна вартість");
}

export function detectBlocks(sheet: XLSX.WorkSheet): DetectedBlock[] {
  const matrix = buildSheetMatrix(sheet);
  if (matrix.length === 0) return [];

  const blocks: DetectedBlock[] = [];
  let i = 0;
  while (i < matrix.length) {
    const row = matrix[i] ?? [];
    if (!isHeaderRow(row)) {
      i += 1;
      continue;
    }

    let titleRow = i;
    for (let p = i - 1; p >= Math.max(0, i - 6); p -= 1) {
      if (looksLikeTitleRow(matrix[p] ?? [])) {
        titleRow = p;
        break;
      }
    }

    let endRow = i + 1;
    for (let r = i + 1; r < matrix.length; r += 1) {
      const current = matrix[r] ?? [];
      if (isFinalTotalRow(current)) {
        endRow = r;
        break;
      }
      if (isHeaderRow(current)) {
        endRow = r - 1;
        break;
      }
      if (looksLikeTitleRow(current)) {
        let hasHeaderAhead = false;
        for (let look = r + 1; look <= Math.min(matrix.length - 1, r + 4); look += 1) {
          if (isHeaderRow(matrix[look] ?? [])) {
            hasHeaderAhead = true;
            break;
          }
        }
        if (hasHeaderAhead) {
          endRow = r - 1;
          break;
        }
      }
      endRow = r;
    }

    blocks.push({
      id: `block-${blocks.length + 1}`,
      titleRow,
      headerRow: i,
      endRow: Math.max(endRow, i),
    });
    i = Math.max(endRow + 1, i + 1);
  }

  return blocks;
}
