/**
 * Архів для ChatGPT: фінанси та закупівлі (хаби /crm/finance, /crm/procurement,
 * вкладка угоди «Фінанси та закупівлі», API deals/.../finance, fp, дашборд CRM).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const BUNDLE_PATHS = [
  "prisma/schema.prisma",
  "src/config/navigation.ts",
  "src/config/entityTabs.ts",
  "src/lib/utils.ts",
  "src/lib/authz/roles.ts",
  "src/lib/finance",
  "src/features/finance",
  "src/features/procurement",
  "src/features/deal-workspace/types.ts",
  "src/features/deal-workspace/queries.ts",
  "src/features/crm-dashboard/executive-types.ts",
  "src/features/crm-dashboard/components/finance-overview-card.tsx",
  "src/features/crm-dashboard/components/procurement-overview-card.tsx",
  "src/components/deal-workspace/tabs/DealFinanceProcurementTab.tsx",
  "src/components/deal-workspace/DealFinanceProjectLinks.tsx",
  "src/app/crm/finance",
  "src/app/crm/procurement",
  "src/app/api/crm/finance",
  "src/app/api/crm/procurement",
  "src/app/api/deals/[dealId]/finance",
  "src/app/api/deals/[dealId]/fp",
  "src/app/api/deals/[dealId]/linkable-projects",
  "src/app/api/projects/[projectId]",
];

function missingPaths() {
  const miss = [];
  for (const rel of BUNDLE_PATHS) {
    const abs = path.join(root, rel);
    if (!fs.existsSync(abs)) miss.push(rel);
  }
  return miss;
}

const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const outDir = path.join(root, "backups", `gpt-finance-procurement-${stamp}`);
fs.mkdirSync(outDir, { recursive: true });

const miss = missingPaths();
if (miss.length) {
  console.error("Відсутні шляхи для бекапу:", miss.join(", "));
  process.exit(1);
}

const readme = `# Архів: фінанси та закупівлі

Знімок коду для аналізу в ChatGPT: **Фінанси** (\`/crm/finance\`), **Закупки** (\`/crm/procurement\`), вкладка угоди **«Фінанси та закупівлі»**, API зведень/рахунків/оплат, генерація закупки з смети (\`fp/generate-procurement\`), зв’язок фін. проєктів з угодою.

## Що включено
- \`prisma/schema.prisma\` — шукайте \`Invoice\`, \`DealPaymentPlan\`, \`MoneyTransaction\`, \`DealPurchaseOrder\`, \`Supplier\`, \`Material\`, \`StockItem\`, фін. проєкти тощо.
- \`src/features/finance\`, \`src/features/procurement\` — UI та логіка оглядів, KPI, експортів.
- \`src/lib/finance/*\` — зведення по угоді, рахунки/оплати, активність.
- API: \`/api/crm/finance/dashboard\`, \`/api/crm/procurement/dashboard\`, \`/api/deals/[dealId]/finance/*\`, \`/api/deals/[dealId]/fp/*\`, \`linkable-projects\`, \`/api/projects/[projectId]\` (прив’язка проєкту до угоди).
- Робоче місце угоди: \`DealFinanceProcurementTab\`, \`DealFinanceProjectLinks\`, фрагмент \`deal-workspace/queries.ts\` (дані для вкладки).
- Картки дашборду: \`finance-overview-card\`, \`procurement-overview-card\` + \`executive-types.ts\`.

## Обмеження
Не включено auth, Prisma-клієнт тощо — архів для **розуміння домену**, не для \`pnpm build\`.

## Інші бекапи
- Повний репо: \`pnpm backup:gpt\`
- Розрахунок по ліду: \`pnpm backup:gpt:lead-pricing\`

Створено: ${new Date().toISOString()}
`;

const readmePath = path.join(outDir, "README_FINANCE_PROCUREMENT_FOR_CHATGPT.md");
fs.writeFileSync(readmePath, readme, "utf-8");

const manifestPath = path.join(outDir, "MANIFEST_FINANCE_PROCUREMENT.txt");
fs.writeFileSync(
  manifestPath,
  ["Шляхи в архіві:", "", ...BUNDLE_PATHS.map((p) => `- ${p}`), ""].join("\n"),
  "utf-8",
);

const tarName = "finance-procurement-for-chatgpt.tar.gz";
const tarPath = path.join(outDir, tarName);

const tarArgs = ["-czf", tarPath, "-C", root, ...BUNDLE_PATHS];
const tr = spawnSync("tar", tarArgs, {
  cwd: root,
  encoding: "utf-8",
  shell: false,
});

if (tr.status !== 0) {
  console.error("tar помилка:", (tr.stderr || tr.stdout || "").slice(0, 800));
  process.exit(1);
}

const stat = fs.statSync(tarPath);
const mb = (stat.size / (1024 * 1024)).toFixed(2);

const zipName = `finance-procurement-for-chatgpt-${stamp}.zip`;
const zipPath = path.join(root, "backups", zipName);
const zipArgs = ["-acf", zipPath, "-C", root, ...BUNDLE_PATHS];
const zr = spawnSync("tar", zipArgs, {
  cwd: root,
  encoding: "utf-8",
  shell: false,
});
if (zr.status !== 0) {
  console.error("ZIP помилка:", (zr.stderr || zr.stdout || "").slice(0, 800));
} else if (fs.existsSync(zipPath)) {
  const zMb = (fs.statSync(zipPath).size / (1024 * 1024)).toFixed(2);
  console.log("OK ZIP →", zipPath, `(${zMb} МБ)`);
}

const latestPointer = path.join(
  root,
  "backups",
  "LATEST_GPT_FINANCE_PROCUREMENT_BUNDLE.txt",
);
fs.writeFileSync(
  latestPointer,
  [
    tarPath,
    zipPath,
    readmePath,
    manifestPath,
    `Створено: ${new Date().toISOString()}`,
    "",
    "Команда: pnpm backup:gpt:finance-procurement",
    "",
  ].join("\n"),
  "utf-8",
);

console.log("OK архів «Фінанси + закупівлі» для GPT:");
console.log(" ", tarPath);
console.log("  Розмір:", mb, "МБ");
console.log("  README:", readmePath);
console.log("  Останній:", latestPointer);
