import fs from "fs";
import path from "path";
import * as XLSX from "xlsx";

function walk(dir, acc = []) {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, f.name);
    if (f.isDirectory()) walk(p, acc);
    else if (f.name.endsWith(".xlsx") && !f.name.startsWith("~$")) acc.push(p);
  }
  return acc;
}

const root = "D:/crm/.tmp-kp-zip-full/BuildBuro";
const files = walk(root);
const target =
  files.find((f) => f.includes("ENVER") && f.includes("16.02.2026")) ||
  files[0];
if (!target) {
  console.error("No xlsx");
  process.exit(1);
}
console.log("FILE:", target);
const wb = XLSX.readFile(target, { cellDates: true });
for (const sn of wb.SheetNames.slice(0, 8)) {
  const sh = wb.Sheets[sn];
  const data = XLSX.utils.sheet_to_json(sh, { header: 1, defval: "" });
  console.log("\n=== SHEET:", sn, "rows:", data.length, "===");
  for (let i = 0; i < Math.min(45, data.length); i++) {
    console.log(String(i + 1).padStart(3), JSON.stringify(data[i]));
  }
}
