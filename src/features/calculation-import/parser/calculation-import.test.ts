import test from "node:test";
import assert from "node:assert/strict";
import * as XLSX from "xlsx";
import { parseExcelWorkbook } from "./excelParser";

function workbookBufferFromRows(rows: Array<Array<string | number | null>>): Buffer {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Просчет");
  const arr = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return Buffer.isBuffer(arr) ? arr : Buffer.from(arr);
}

test("parses multiple product blocks from one sheet", () => {
  const buffer = workbookBufferFromRows([
    ["Стіл для переговорів", null, null, null, null],
    ["Найменування", "Кіль-сть", "Коеф", "Ціна", "Сума"],
    ["ДСП Egger", 3, 1, 1000, 3000],
    ["Загальна СОБІВАРТІСТЬ", null, null, null, 3000],
    ["Замір", 1, 1, 500, 500],
    ["Загальна ВАРТІСТЬ", null, null, null, 3500],
    ["", "", "", "", ""],
    ["Шафа", null, null, null, null],
    ["Найменування", "Кіль-сть", "Коеф", "Ціна", "Сума"],
    ["МДФ", 2, 1, 2000, 4000],
    ["Загальна СОБІВАРТІСТЬ", null, null, null, 4000],
    ["Загальна ВАРТІСТЬ", null, null, null, 4000],
  ]);
  const parsed = parseExcelWorkbook({ fileName: "multi.xlsx", fileBuffer: buffer });
  assert.equal(parsed.sheets[0]?.blocks.length, 2);
});

test("handles missing columns with fallback mapping", () => {
  const buffer = workbookBufferFromRows([
    ["Шафа", null, null],
    ["Найменування", "Кіль-сть", "Сума"],
    ["ДСП", 2, 1200],
    ["Загальна ВАРТІСТЬ", null, 1200],
  ]);
  const parsed = parseExcelWorkbook({ fileName: "missing-cols.xlsx", fileBuffer: buffer });
  const block = parsed.sheets[0]?.blocks[0];
  assert.ok(block);
  assert.ok(block?.warnings.length >= 0);
});

test("keeps formula marker on amount cell", () => {
  const ws = XLSX.utils.aoa_to_sheet([
    ["Шафа"],
    ["Найменування", "Кіль-сть", "Коеф", "Ціна", "Сума"],
    ["ДСП", 2, 1, 1000, null],
    ["Загальна ВАРТІСТЬ", null, null, null, 2000],
  ]);
  ws.E3 = { t: "n", f: "B3*C3*D3", v: 2000 };
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Просчет");
  const fileBuffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  const parsed = parseExcelWorkbook({ fileName: "formula.xlsx", fileBuffer });
  const line = parsed.sheets[0]?.blocks[0]?.items[0];
  assert.ok(line);
  assert.equal(line?.formula, "B3*C3*D3");
});

test("skips empty rows safely", () => {
  const buffer = workbookBufferFromRows([
    ["Тумба"],
    ["Найменування", "Кіль-сть", "Коеф", "Ціна", "Сума"],
    [null, null, null, null, null],
    ["Петлі", 2, 1, 100, 200],
    ["Загальна ВАРТІСТЬ", null, null, null, 200],
  ]);
  const parsed = parseExcelWorkbook({ fileName: "empty-rows.xlsx", fileBuffer: buffer });
  assert.equal(parsed.sheets[0]?.blocks[0]?.items.length, 1);
});

test("supports merged title cells", () => {
  const ws = XLSX.utils.aoa_to_sheet([
    ["Стіл", null, null, null, null],
    ["Найменування", "Кіль-сть", "Коеф", "Ціна", "Сума"],
    ["ДСП", 1, 1, 1000, 1000],
    ["Загальна ВАРТІСТЬ", null, null, null, 1000],
  ]);
  ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 3 } }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Просчет");
  const fileBuffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  const parsed = parseExcelWorkbook({ fileName: "merged.xlsx", fileBuffer });
  assert.equal(parsed.sheets[0]?.blocks.length, 1);
  assert.equal(parsed.sheets[0]?.blocks[0]?.productName, "Стіл");
});
