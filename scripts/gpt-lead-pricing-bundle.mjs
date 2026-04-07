/**
 * Вузький архів для ChatGPT: лише код вкладки ліда «Розрахунок» (смета, версії, КП, API),
 * без повного репозиторію.
 *
 * Результат: backups/gpt-lead-pricing-<stamp>/lead-pricing-for-chatgpt.tar.gz
 *            + README_LEAD_PRICING_FOR_CHATGPT.md
 *            + backups/lead-pricing-for-chatgpt-<stamp>.zip
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

/** Шляхи відносно кореня репо — UI «Розрахунок», lib/estimates, API ліда, схема Prisma. */
const BUNDLE_PATHS = [
  "prisma/schema.prisma",
  "src/config/entityTabs.ts",
  "src/components/leads/LeadDetailView.tsx",
  "src/components/leads/lead-detail/LeadPage.tsx",
  "src/components/shared/EntitySubnav.tsx",
  "src/features/leads/queries.ts",
  "src/lib/estimates",
  "src/lib/quotes",
  "src/lib/api/parse-response-json.ts",
  "src/lib/utils.ts",
  "src/lib/materials",
  "src/lib/leads/move-lead-estimates-to-deal.ts",
  "src/lib/leads/estimate-sales-heuristics.ts",
  "src/modules/leads/lead-estimate",
  "src/modules/leads/lead-pricing",
  "src/modules/leads/lead-proposal",
  "src/app/(dashboard)/leads/[leadId]/estimate",
  "src/app/api/leads/[leadId]/estimates",
  "src/app/api/leads/[leadId]/estimate-workspace",
  "src/app/api/leads/[leadId]/proposals",
  "src/app/api/leads/[leadId]/attachments/[attachmentId]/analyze-estimate",
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
const outDir = path.join(root, "backups", `gpt-lead-pricing-${stamp}`);
fs.mkdirSync(outDir, { recursive: true });

const miss = missingPaths();
if (miss.length) {
  console.error("Відсутні шляхи для бекапу:", miss.join(", "));
  process.exit(1);
}

const readme = `# Архів: вкладка ліда «Розрахунок» (смета / pricing)

Менший знімок коду, ніж \`pnpm backup:gpt\`, щоб передати в ChatGPT лише логіку **розрахунку вартості** по ліду: таб «Розрахунок» (\`/leads/:id/pricing\`), редактор смети, версії, КП, API та Prisma-моделі \`Estimate\`.

## Що включено
- \`prisma/schema.prisma\` (усі моделі; для оцінки шукайте \`Estimate\`, \`EstimateLineItem\`, \`EstimateSection\`, \`LeadProposal\`)
- \`src/modules/leads/lead-pricing\`, \`lead-estimate\`, \`lead-proposal\` — UI робочого місця
- \`src/lib/estimates/*\` — перерахунок, серіалізація, AI, шаблони кухні тощо
- API: \`src/app/api/leads/[leadId]/estimates\`, \`estimate-workspace\`, \`proposals\`, \`analyze-estimate\`
- Сторінки: \`src/app/(dashboard)/leads/[leadId]/estimate/*\`
- Обгортка картки ліда: \`LeadPage\` / \`LeadDetailView\`, таби в \`entityTabs\`, типи/запити в \`features/leads/queries.ts\`

## Чого може не вистачати для повної збірки
Залежності від інших модулів (auth, загальні UI) не копіюються — цей архів для **аналізу домену смети**, не для \`pnpm build\`.

## Повний репозиторій
\`pnpm backup:gpt\` — повний знімок без секретів.

Створено: ${new Date().toISOString()}
`;

const readmePath = path.join(outDir, "README_LEAD_PRICING_FOR_CHATGPT.md");
fs.writeFileSync(readmePath, readme, "utf-8");

const manifestPath = path.join(outDir, "MANIFEST_LEAD_PRICING.txt");
fs.writeFileSync(
  manifestPath,
  ["Шляхи в архіві:", "", ...BUNDLE_PATHS.map((p) => `- ${p}`), ""].join("\n"),
  "utf-8",
);

const tarName = "lead-pricing-for-chatgpt.tar.gz";
const tarPath = path.join(outDir, tarName);

const tarArgs = ["-czf", tarPath, "-C", root, ...BUNDLE_PATHS];
const tr = spawnSync("tar", tarArgs, {
  cwd: root,
  encoding: "utf-8",
  shell: false,
});

if (tr.status !== 0) {
  console.error(
    "tar помилка:",
    (tr.stderr || tr.stdout || "").slice(0, 800),
  );
  process.exit(1);
}

const stat = fs.statSync(tarPath);
const mb = (stat.size / (1024 * 1024)).toFixed(2);

const zipName = `lead-pricing-for-chatgpt-${stamp}.zip`;
const zipPath = path.join(root, "backups", zipName);
const zipArgs = ["-acf", zipPath, "-C", root, ...BUNDLE_PATHS];
const zr = spawnSync("tar", zipArgs, {
  cwd: root,
  encoding: "utf-8",
  shell: false,
});
if (zr.status !== 0) {
  console.error(
    "ZIP помилка:",
    (zr.stderr || zr.stdout || "").slice(0, 800),
  );
} else if (fs.existsSync(zipPath)) {
  const zMb = (fs.statSync(zipPath).size / (1024 * 1024)).toFixed(2);
  console.log("OK ZIP →", zipPath, `(${zMb} МБ)`);
}

const latestPointer = path.join(root, "backups", "LATEST_GPT_LEAD_PRICING_BUNDLE.txt");
fs.writeFileSync(
  latestPointer,
  [
    tarPath,
    zipPath,
    readmePath,
    manifestPath,
    `Створено: ${new Date().toISOString()}`,
    "",
    "Команда: pnpm backup:gpt:lead-pricing",
    "",
  ].join("\n"),
  "utf-8",
);

console.log("OK архів «Розрахунок» (лід) для GPT:");
console.log(" ", tarPath);
console.log("  Розмір:", mb, "МБ");
console.log("  README:", readmePath);
console.log("  Останній:", latestPointer);
