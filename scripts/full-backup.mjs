/**
 * Повний бекап: дамп PostgreSQL (pg_dump) + архів вихідного коду (tar.gz) + один .zip з усім каталогом бекапу.
 * Результат: backups/YYYY-MM-DDTHH-MM-SS/{database.sql, source.tar.gz, manifest.json}
 *            backups/crm-full-backup-YYYY-MM-DDTHH-MM-SS.zip
 */
import { createHash } from "node:crypto";
import { config } from "dotenv";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

config({ path: path.join(root, ".env.local") });
config({ path: path.join(root, ".env") });

const databaseUrl = process.env.DATABASE_URL?.trim();

const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const outDir = path.join(root, "backups", stamp);
fs.mkdirSync(outDir, { recursive: true });

const manifest = {
  createdAt: new Date().toISOString(),
  cwd: root,
  databaseDump: false,
  sourceArchive: false,
  zipArchive: false,
  zipPath: null,
  /** @type {Record<string, string>} */
  checksums: {},
  notes: [],
};

/** Потокове SHA256 — `readFileSync` падає на файлах > 2 GiB (ERR_FS_FILE_TOO_LARGE). */
function sha256File(filePath) {
  const hash = createHash("sha256");
  const fd = fs.openSync(filePath, "r");
  try {
    const chunk = Buffer.allocUnsafe(1024 * 1024);
    let n;
    while ((n = fs.readSync(fd, chunk, 0, chunk.length, null)) > 0) {
      hash.update(n === chunk.length ? chunk : chunk.subarray(0, n));
    }
  } finally {
    fs.closeSync(fd);
  }
  return `sha256:${hash.digest("hex")}`;
}

function resolvePgDump() {
  const winPaths = [
    "C:\\Program Files\\PostgreSQL\\17\\bin\\pg_dump.exe",
    "C:\\Program Files\\PostgreSQL\\16\\bin\\pg_dump.exe",
    "C:\\Program Files\\PostgreSQL\\15\\bin\\pg_dump.exe",
  ];
  for (const p of winPaths) {
    if (fs.existsSync(p)) return p;
  }
  const w = spawnSync("where.exe", ["pg_dump"], {
    encoding: "utf-8",
    shell: false,
  });
  if (w.status === 0 && w.stdout?.trim()) {
    return w.stdout.trim().split(/\r?\n/)[0];
  }
  return null;
}

if (!databaseUrl) {
  manifest.notes.push("DATABASE_URL відсутній — дамп БД пропущено.");
  console.warn(manifest.notes.at(-1));
} else {
  const pgDump = resolvePgDump();
  const sqlFile = path.join(outDir, "database.sql");
  if (!pgDump) {
    manifest.notes.push("pg_dump не знайдено у PATH / стандартних шляхах Windows.");
    console.warn(manifest.notes.at(-1));
  } else {
    const r = spawnSync(
      pgDump,
      ["--no-owner", "--no-acl", "--format=plain", "-f", sqlFile, databaseUrl],
      { encoding: "utf-8", env: { ...process.env } },
    );
    if (r.status !== 0) {
      manifest.notes.push(
        `pg_dump помилка: ${(r.stderr || r.stdout || "").slice(0, 500)}`,
      );
      console.error(manifest.notes.at(-1));
    } else {
      manifest.databaseDump = true;
      console.log("OK БД →", sqlFile);
    }
  }
}

const tarFile = path.join(outDir, "source.tar.gz");
const exclude = ["node_modules", ".next", "backups", "storage"];
const tarArgs = [
  "-czf",
  tarFile,
  ...exclude.flatMap((e) => ["--exclude", e]),
  ".",
];
const tr = spawnSync("tar", tarArgs, {
  cwd: root,
  encoding: "utf-8",
});
if (tr.status !== 0) {
  manifest.notes.push(
    `tar помилка (код ${tr.status}): ${(tr.stderr || tr.stdout || "").slice(0, 400)}`,
  );
  console.error(manifest.notes.at(-1));
} else {
  manifest.sourceArchive = true;
  console.log("OK код →", tarFile);
}

const sqlFile = path.join(outDir, "database.sql");
if (manifest.databaseDump && fs.existsSync(sqlFile)) {
  manifest.checksums.databaseSql = sha256File(sqlFile);
}
if (manifest.sourceArchive && fs.existsSync(tarFile)) {
  manifest.checksums.sourceTarGz = sha256File(tarFile);
}

const zipName = `crm-full-backup-${stamp}.zip`;
const zipPath = path.join(root, "backups", zipName);
manifest.zipPath = zipPath;

function writeManifest() {
  fs.writeFileSync(
    path.join(outDir, "manifest.json"),
    JSON.stringify(manifest, null, 2),
    "utf-8",
  );
}

function runZip() {
  if (process.platform === "win32") {
    const esc = (s) => s.replace(/'/g, "''");
    const ps = `Compress-Archive -LiteralPath '${esc(outDir)}' -DestinationPath '${esc(zipPath)}' -Force`;
    return spawnSync("powershell", ["-NoProfile", "-Command", ps], {
      encoding: "utf-8",
    });
  }
  return spawnSync("zip", ["-r", "-q", zipPath, stamp], {
    cwd: path.join(root, "backups"),
    encoding: "utf-8",
  });
}

writeManifest();
const zr = runZip();
if (zr.status !== 0) {
  const msg =
    process.platform === "win32"
      ? `ZIP (PowerShell): ${(zr.stderr || zr.stdout || "").slice(0, 400)}`
      : `zip помилка (код ${zr.status}): ${(zr.stderr || zr.stdout || "").slice(0, 400)}`;
  manifest.notes.push(msg);
  console.error(msg);
} else {
  manifest.zipArchive = true;
  if (fs.existsSync(zipPath)) {
    manifest.checksums.fullZip = sha256File(zipPath);
  }
  writeManifest();
  console.log("OK ZIP →", zipPath);
}

console.log("Маніфест →", path.join(outDir, "manifest.json"));
console.log("Каталог бекапу:", outDir);

if (!manifest.databaseDump && databaseUrl) process.exitCode = 1;
if (!manifest.sourceArchive) process.exitCode = 1;
