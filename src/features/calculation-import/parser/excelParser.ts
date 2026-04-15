import * as XLSX from "xlsx";
import { detectBlocks } from "./detectBlocks";
import { parseBlock } from "./parseBlock";
import { normalizeRows } from "../normalizers/normalizeRows";
import { validateCalculation } from "../validators/validateCalculation";
import type { ImportedWorkbook, ImportedSheet } from "../types/calculationImport.types";

function parseSheet(sheetName: string, sheet: XLSX.WorkSheet): ImportedSheet {
  const detected = detectBlocks(sheet);
  const blocks = detected.map((block) => {
    const parsed = parseBlock(sheet, block);
    parsed.items = normalizeRows(parsed.items);
    parsed.extras = normalizeRows(parsed.extras);
    const validationWarnings = validateCalculation(parsed);
    parsed.warnings = [...parsed.warnings, ...validationWarnings];
    return parsed;
  });
  return { name: sheetName, blocks };
}

export function parseExcelWorkbook(args: {
  fileName: string;
  fileBuffer: Buffer;
}): ImportedWorkbook {
  const wb = XLSX.read(args.fileBuffer, {
    type: "buffer",
    cellFormula: true,
    cellNF: true,
    cellText: true,
  });

  const sheets = wb.SheetNames.map((sheetName) => {
    const sheet = wb.Sheets[sheetName];
    if (!sheet) return { name: sheetName, blocks: [] };
    return parseSheet(sheetName, sheet);
  });

  return {
    fileName: args.fileName,
    sheets,
    parsedAt: new Date().toISOString(),
  };
}
