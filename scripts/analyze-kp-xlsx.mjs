/**
 * Одноразовий аналіз xlsx з архіву (вивід у консоль).
 * node scripts/analyze-kp-xlsx.mjs
 */
import * as fs from "node:fs";
import * as path from "node:path";
import XLSX from "xlsx";

const defaultFile =
  process.argv[2] ||
  "D:\\crm\\.tmp-kp-zip-full\\BuildBuro\\КП_КП\\КП_КП ENVER_  BuildBuro 16.02.2026.xlsx";

function findEnver() {
  const root = "D:\\crm\\.tmp-kp-zip-full\\BuildBuro";
  if (!fs.existsSync(root)) return null;
  const stack = [root];
  while (stack.length) {
    const d = stack.pop();
    for (const name of fs.readdirSync(d)) {
      const p = path.join(d, name);
      const st = fs.statSync(p);
      if (st.isDirectory()) stack.push(p);
      else if (
        name.endsWith(".xlsx") &&
        !name.startsWith("~$") &&
        name.includes("ENVER") &&
        name.includes("16.02.2026")
      ) {
        return p;
      }
    }
  }
  return null;
}

const file = fs.existsSync(defaultFile) ? defaultFile : findEnver();
if (!file || !fs.existsSync(file)) {
  console.error("File not found. Pass path as argv[1] or extract zip to .tmp-kp-zip-full");
  process.exit(1);
}

console.log("FILE:", file);
const buf = fs.readFileSync(file);
const wb = XLSX.read(buf, { type: "buffer", cellDates: true });
console.log("Sheets:", wb.SheetNames);

for (const name of wb.SheetNames.slice(0, 5)) {
  const ws = wb.Sheets[name];
  const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
  console.log("\n===", name, "rows:", data.length, "===");
  const preview = data.slice(0, 35);
  for (let i = 0; i < preview.length; i++) {
    const row = preview[i];
    const line = row.map((c) => String(c).slice(0, 60)).join(" | ");
    console.log(String(i + 1).padStart(3), line);
  }
}
