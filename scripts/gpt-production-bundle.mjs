/**
 * Архів для ChatGPT: модуль виробництва (CRM / production queue / orchestration).
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
  "src/lib/production",
  "src/modules/production",
  "src/components/production",
  "src/components/crm-production",
  "src/components/production-ecosystem",
  "src/components/deal-workspace/ProductionOrchestrationHandoffPanel.tsx",
  "src/app/crm/production",
  "src/app/api/crm/production",
  "src/app/api/production",
  "src/app/api/deals/[dealId]/production-launch",
  "src/app/api/deals/[dealId]/production-orchestration",
  "src/app/(dashboard)/production",
  "src/features/crm-dashboard/components/production-overview-card.tsx",
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
const outDir = path.join(root, "backups", `gpt-production-${stamp}`);
fs.mkdirSync(outDir, { recursive: true });

const miss = missingPaths();
if (miss.length) {
  console.error("Відсутні шляхи для бекапу:", miss.join(", "));
  process.exit(1);
}

const readme = `# Архів: виробництво (Production)

Знімок коду для аналізу в ChatGPT: **модуль виробництва** (черга робіт, підсторінки \`/production/*\`, API production, запуск у виробництво, orchestration по угоді).

## Що включено
- \`src/app/crm/production\` — CRM-інтерфейс виробництва.
- \`src/app/(dashboard)/production\` — dashboard-сторінки production.
- \`src/app/api/crm/production\`, \`src/app/api/production\` — API черги/карток/таблиць.
- \`src/app/api/deals/[dealId]/production-launch\` та \`production-orchestration\`.
- \`src/lib/production\`, \`src/modules/production\` — доменна логіка, правила та автоматика.
- \`src/components/production*\`, \`ProductionOrchestrationHandoffPanel\`.
- \`prisma/schema.prisma\` для контексту моделей.

## Обмеження
Не включено повний репозиторій — архів для **аналізу домену виробництва**, не для \`pnpm build\`.

## Інші бекапи
- Повний репо: \`pnpm backup:gpt\`
- Фінанси + закупівлі: \`pnpm backup:gpt:finance-procurement\`

Створено: ${new Date().toISOString()}
`;

const readmePath = path.join(outDir, "README_PRODUCTION_FOR_CHATGPT.md");
fs.writeFileSync(readmePath, readme, "utf-8");

const manifestPath = path.join(outDir, "MANIFEST_PRODUCTION.txt");
fs.writeFileSync(
  manifestPath,
  ["Шляхи в архіві:", "", ...BUNDLE_PATHS.map((p) => `- ${p}`), ""].join("\n"),
  "utf-8",
);

const tarName = "production-for-chatgpt.tar.gz";
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

const mb = (fs.statSync(tarPath).size / (1024 * 1024)).toFixed(2);

const zipName = `production-for-chatgpt-${stamp}.zip`;
const zipPath = path.join(root, "backups", zipName);
const zr = spawnSync("tar", ["-acf", zipPath, "-C", root, ...BUNDLE_PATHS], {
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
  "LATEST_GPT_PRODUCTION_BUNDLE.txt",
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
    "Команда: pnpm backup:gpt:production",
    "",
  ].join("\n"),
  "utf-8",
);

console.log("OK архів «Виробництво» для GPT:");
console.log(" ", tarPath);
console.log("  Розмір:", mb, "МБ");
console.log("  README:", readmePath);
console.log("  Останній:", latestPointer);
