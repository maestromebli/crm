/**
 * Максимальний архів для ChatGPT: модуль розрахунку (лід) + скріншоти роботи.
 *
 * Результат:
 * backups/gpt-lead-pricing-max-<stamp>/lead-pricing-max-for-chatgpt.tar.gz
 * backups/lead-pricing-max-for-chatgpt-<stamp>.zip
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

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
  "src/features/suppliers",
  "src/app/(dashboard)/leads/[leadId]/estimate",
  "src/app/api/leads/[leadId]/estimates",
  "src/app/api/leads/[leadId]/estimate-workspace",
  "src/app/api/leads/[leadId]/proposals",
  "src/app/api/leads/[leadId]/attachments/[attachmentId]/analyze-estimate",
  "docs/site-restoration/screenshots/lead-pricing",
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
const outDir = path.join(root, "backups", `gpt-lead-pricing-max-${stamp}`);
fs.mkdirSync(outDir, { recursive: true });

const miss = missingPaths();
if (miss.length) {
  console.error("Відсутні шляхи для max-бекапу:", miss.join(", "));
  process.exit(1);
}

const readmePath = path.join(outDir, "README_LEAD_PRICING_MAX_FOR_CHATGPT.md");
fs.writeFileSync(
  readmePath,
  `# MAX архів: розрахунок вартості ліда + скріншоти

Цей бандл призначений для глибокого аналізу в ChatGPT.

## Включено
- Повний профільний код розрахунку (pricing/estimate/kp + API + lib/estimates + suppliers)
- Prisma схема
- Скріншоти роботи розрахунку: \`docs/site-restoration/screenshots/lead-pricing\`

Створено: ${new Date().toISOString()}
`,
  "utf-8",
);

const manifestPath = path.join(outDir, "MANIFEST_LEAD_PRICING_MAX.txt");
fs.writeFileSync(
  manifestPath,
  ["Шляхи в архіві:", "", ...BUNDLE_PATHS.map((p) => `- ${p}`), ""].join("\n"),
  "utf-8",
);

const tarName = "lead-pricing-max-for-chatgpt.tar.gz";
const tarPath = path.join(outDir, tarName);
const tarArgs = ["-czf", tarPath, "-C", root, ...BUNDLE_PATHS];
const tr = spawnSync("tar", tarArgs, { cwd: root, encoding: "utf-8", shell: false });
if (tr.status !== 0) {
  console.error("tar помилка:", (tr.stderr || tr.stdout || "").slice(0, 800));
  process.exit(1);
}

const zipName = `lead-pricing-max-for-chatgpt-${stamp}.zip`;
const zipPath = path.join(root, "backups", zipName);
const zr = spawnSync("tar", ["-acf", zipPath, "-C", root, ...BUNDLE_PATHS], {
  cwd: root,
  encoding: "utf-8",
  shell: false,
});
if (zr.status !== 0) {
  console.error("ZIP помилка:", (zr.stderr || zr.stdout || "").slice(0, 800));
  process.exit(1);
}

const pointer = path.join(root, "backups", "LATEST_GPT_LEAD_PRICING_MAX_BUNDLE.txt");
const tarMb = (fs.statSync(tarPath).size / (1024 * 1024)).toFixed(2);
const zipMb = (fs.statSync(zipPath).size / (1024 * 1024)).toFixed(2);
fs.writeFileSync(
  pointer,
  [
    `TAR: ${tarPath} (${tarMb} МБ)`,
    `ZIP: ${zipPath} (${zipMb} МБ)`,
    `README: ${readmePath}`,
    `MANIFEST: ${manifestPath}`,
    `Час: ${new Date().toISOString()}`,
    "",
  ].join("\n"),
  "utf-8",
);

console.log("OK MAX бекап lead pricing:");
console.log(" ", tarPath, `(${tarMb} МБ)`);
console.log(" ", zipPath, `(${zipMb} МБ)`);
console.log(" pointer:", pointer);
