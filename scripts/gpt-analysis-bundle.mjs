/**
 * Архів для передачі в ChatGPT / інший LLM: код + доки + схема БД,
 * без node_modules, .next, .git, .env* (секрети).
 *
 * Результат: backups/gpt-analysis-<stamp>/crm-for-chatgpt-analysis.tar.gz
 *            + README_FOR_CHATGPT.md
 *            + backups/crm-for-chatgpt-analysis-<stamp>.zip (той самий зміст, що й .tar.gz — зручно для ChatGPT)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const outDir = path.join(root, "backups", `gpt-analysis-${stamp}`);
fs.mkdirSync(outDir, { recursive: true });

const readme = `# Архів для аналізу проєкту (CRM)

Цей каталог містить **crm-for-chatgpt-analysis.tar.gz** — знімок репозиторію без секретів і без важких артефактів.

## Що включено
- Вихідний код (\`src/\`, \`apps/\` якщо є)
- Документація (\`docs/\`)
- Prisma: \`prisma/schema.prisma\`, \`prisma/sql/\`, seed
- Конфіги: \`package.json\`, \`pnpm-lock.yaml\`, \`tsconfig*\`, \`next.config.*\`, ESLint, Tailwind, \`prisma.config.ts\`
- Скрипти (\`scripts/\`)

## Що виключено (навмисно)
- \`node_modules\`, \`.next\`, \`.git\`
- \`backups/\` (рекурсія), \`storage/\` (завантаження користувачів)
- \`test-results/\`, \`playwright-report/\`, тимчасові \`.tmp-*\` (інакше архів роздувається до гігабайтів)
- \`.env\`, \`.env.local\` — **паролі та ключі не потрапляють у архів**
- \`.vercel\`, \`*.tsbuildinfo\`

## Як використати в ChatGPT
1. Завантажте файл **crm-for-chatgpt-analysis.tar.gz** у чат (або розпакуйте й надсилайте ключові файли).
2. Попросіть, наприклад: «Проаналізуй архітектуру Next.js-додатку, API routes, Prisma-схему та дорожню карту в docs/».

## Повний бекап з БД
Якщо потрібен ще й дамп PostgreSQL: \`pnpm backup:full\` (потрібні \`DATABASE_URL\` та \`pg_dump\`). **Не діліться** повним бекапом з третіми сторонами без видалення секретів з архіву.

Створено: ${new Date().toISOString()}
`;

const readmePath = path.join(outDir, "README_FOR_CHATGPT.md");
fs.writeFileSync(readmePath, readme, "utf-8");

const tarName = "crm-for-chatgpt-analysis.tar.gz";
const tarPath = path.join(outDir, tarName);

/** Узгоджено з типовими лімітами завантаження файлів у чат (залежить від тарифу; перевірте в UI). */
const CHAT_UPLOAD_WARN_MB = 512;

const excludes = [
  "node_modules",
  ".next",
  "backups",
  ".git",
  "storage",
  "test-results",
  "playwright-report",
  ".turbo",
  "coverage",
  ".env",
  ".env.local",
  ".env.development.local",
  ".env.production.local",
  ".env.test.local",
  ".vercel",
  "*.tsbuildinfo",
  ".tmp-drive-forms",
  ".tmp-kp-zip-full",
  ".tmp-zip-analysis",
];

// У корені часто лежать тимчасові розпаковані бекапи `.tmp-*` (гігабайти); tar --exclude ".tmp-*" на Windows ненадійний — додаємо явно.
try {
  for (const ent of fs.readdirSync(root, { withFileTypes: true })) {
    if (ent.isDirectory() && ent.name.startsWith(".tmp") && !excludes.includes(ent.name)) {
      excludes.push(ent.name);
    }
  }
} catch {
  // ignore
}

const tarArgs = [
  "-czf",
  tarPath,
  ...excludes.flatMap((e) => ["--exclude", e]),
  ".",
];

const tr = spawnSync("tar", tarArgs, {
  cwd: root,
  encoding: "utf-8",
  shell: false,
});

if (tr.status !== 0) {
  console.error(
    "tar помилка:",
    (tr.stderr || tr.stdout || "").slice(0, 600),
  );
  process.exit(1);
}

const stat = fs.statSync(tarPath);
const mb = (stat.size / (1024 * 1024)).toFixed(2);

const zipName = `crm-for-chatgpt-analysis-${stamp}.zip`;
const zipPath = path.join(root, "backups", zipName);

const zipArgs = [
  "-acf",
  zipPath,
  ...excludes.flatMap((e) => ["--exclude", e]),
  ".",
];
const zr = spawnSync("tar", zipArgs, {
  cwd: root,
  encoding: "utf-8",
  shell: false,
});
if (zr.status !== 0) {
  console.error(
    "ZIP для GPT (tar -acf) помилка:",
    (zr.stderr || zr.stdout || "").slice(0, 600),
  );
} else if (fs.existsSync(zipPath)) {
  const zBytes = fs.statSync(zipPath).size;
  const zMb = (zBytes / (1024 * 1024)).toFixed(2);
  console.log("OK ZIP для GPT →", zipPath, `(${zMb} МБ)`);
  if (zBytes > CHAT_UPLOAD_WARN_MB * 1024 * 1024) {
    console.warn(
      `\n⚠ Розмір ZIP (${zMb} МБ) перевищує орієнтир ~${CHAT_UPLOAD_WARN_MB} МБ для завантаження в чат. Розділіть архів, скоротіть вміст або перевірте ліміт свого тарифу.\n`,
    );
  }
}

const latestPointer = path.join(root, "backups", "LATEST_GPT_BUNDLE.txt");
fs.mkdirSync(path.dirname(latestPointer), { recursive: true });
fs.writeFileSync(
  latestPointer,
  [
    tarPath,
    zipPath,
    readmePath,
    `Створено: ${new Date().toISOString()}`,
    "",
    "Підказка: завантажте .zip або .tar.gz у ChatGPT або див. FOR_CHATGPT_UA.md у корені репо.",
    "",
  ].join("\n"),
  "utf-8",
);

const tarBytes = fs.statSync(tarPath).size;
console.log("OK архів для GPT:");
console.log(" ", tarPath);
console.log("  Розмір .tar.gz:", mb, "МБ");
if (tarBytes > CHAT_UPLOAD_WARN_MB * 1024 * 1024) {
  console.warn(
    `  ⚠ .tar.gz теж великий — для ChatGPT зручніше .zip (див. рядок вище) або розбиття на частини.`,
  );
}
console.log("  Інструкція:", readmePath);
console.log("  Останній бекап:", latestPointer);
