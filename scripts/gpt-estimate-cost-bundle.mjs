/**
 * ZIP для ChatGPT: лише логіка «розрахунок вартості» / комерційні пропозиції / оцінки.
 * Без node_modules, секретів, повного репо.
 *
 * Результат: backups/gpt-estimate-cost-<stamp>/ + .zip поруч
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const bundleName = `gpt-estimate-cost-${stamp}`;
const outDir = path.join(root, "backups", bundleName);
fs.mkdirSync(outDir, { recursive: true });

/** Каталоги відносно root (рекурсивно). */
const DIRS = [
  "src/features/estimate",
  "src/lib/estimates",
  "src/lib/estimate-workspace",
  "src/lib/materials",
  "src/modules/leads/lead-pricing",
  "src/app/api/deals/[dealId]/estimates",
  "src/app/api/leads/[leadId]/estimates",
];

/** Окремі файли (контекст угоди / синк з оцінкою). */
const FILES = [
  "prisma/schema.prisma",
  "src/components/deal-workspace/tabs/EstimateWorkspaceTab.tsx",
  "src/components/deal-workspace/SyncDealValueFromEstimateButton.tsx",
];

function copyDir(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.cpSync(src, dest, { recursive: true });
}

for (const rel of DIRS) {
  const src = path.join(root, rel);
  if (!fs.existsSync(src)) {
    console.warn("Пропуск (немає):", rel);
    continue;
  }
  const dest = path.join(outDir, rel);
  copyDir(src, dest);
}

for (const rel of FILES) {
  const src = path.join(root, rel);
  if (!fs.existsSync(src)) {
    console.warn("Пропуск (немає):", rel);
    continue;
  }
  const dest = path.join(outDir, rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

const readme = `# Архів: розрахунок вартості та комерційні пропозиції (CRM)

Мета: **аналіз логіки цін, собівартості, знижок, підсумків** у Next.js + Prisma без зайвого коду репозиторію.

## Що всередині
- \`src/features/estimate/\` — домен рядка оцінки, \`calculations.ts\`, маппери
- \`src/lib/estimates/\` — перерахунки, PDF, AI-чернетки, порівняння версій
- \`src/lib/estimate-workspace/\` — режими розрахунку (\`calc-line.ts\`)
- \`src/lib/materials/\` — довідник матеріалів / імпорт цін
- \`src/modules/leads/lead-pricing/\` — UI робочого місця ціноутворення по ліду
- API: \`src/app/api/.../estimates/\`
- \`prisma/schema.prisma\` — моделі \`Estimate*\` (фрагмент схеми БД)
- вкладка угоди: \`EstimateWorkspaceTab.tsx\`, синк суми угоди

## Питання для ChatGPT (приклади)
- Чи узгоджені формули \`calculateItemCost\` / \`calculateEstimateSummary\` з API збереження?
- Де можливі округлення або подвійний податок націнки (\`lineSaleScale\`)?
- Як узгоджені типи Prisma та \`EstimateItem\` у \`line-domain-mapper\`?

Створено: ${new Date().toISOString()}
`;

fs.writeFileSync(path.join(outDir, "README_FOR_CHATGPT.md"), readme, "utf-8");

const zipName = `crm-estimate-cost-for-chatgpt-${stamp}.zip`;
const zipPath = path.join(root, "backups", zipName);

const zr = spawnSync(
  "tar",
  ["-acf", zipPath, "-C", path.dirname(outDir), path.basename(outDir)],
  { cwd: root, encoding: "utf-8", shell: false },
);
if (zr.status !== 0) {
  console.error("tar -acf:", (zr.stderr || zr.stdout || "").slice(0, 800));
  process.exit(1);
}

const mb = (fs.statSync(zipPath).size / (1024 * 1024)).toFixed(2);
const pointer = path.join(root, "backups", "LATEST_ESTIMATE_COST_GPT_BUNDLE.txt");
fs.writeFileSync(
  pointer,
  [`ZIP: ${zipPath}`, `Каталог: ${outDir}`, `Розмір: ${mb} МБ`, `Час: ${new Date().toISOString()}`, ""].join(
    "\n",
  ),
  "utf-8",
);

console.log("OK →", zipPath, `(${mb} МБ)`);
console.log("   ", outDir);
console.log("   pointer:", pointer);
