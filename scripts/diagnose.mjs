/**
 * Швидка перевірка середовища перед запуском CRM.
 * Запуск: pnpm diagnose   (з папки проєкту)
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(root);

console.log("\n=== ENVER CRM — діагностика ===\n");

console.log("Папка проєкту:", root);
console.log("Node.js:", process.version);

function trySh(cmd) {
  try {
    return { ok: true, out: execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim() };
  } catch {
    return { ok: false, out: "" };
  }
}

const npm = trySh("npm -v");
console.log("npm:", npm.ok ? npm.out : "НЕ ЗНАЙДЕНО — встановіть Node.js з nodejs.org");

const pnpm = trySh("pnpm -v");
console.log("pnpm:", pnpm.ok ? pnpm.out : "не в PATH (можна: npm i -g pnpm)");

const next = trySh("npx next --version");
console.log("next (npx):", next.ok ? next.out : "помилка виклику npx");

const pkg = path.join(root, "package.json");
console.log("package.json:", fs.existsSync(pkg) ? "OK" : "ВІДСУТНІЙ");

const nodeModules = path.join(root, "node_modules");
console.log("node_modules:", fs.existsSync(nodeModules) ? "OK" : "Запустіть: pnpm install");

const envLocal = path.join(root, ".env.local");
console.log(".env.local:", fs.existsSync(envLocal) ? "є" : "немає (може знадобитись DATABASE_URL)");

console.log("\n--- Порт 3000 (Windows) ---\n");
try {
  const net = execSync("netstat -ano | findstr :3000", { encoding: "utf8", shell: true });
  console.log(net.trim() || "порт 3000 вільний");
} catch {
  console.log("порт 3000 вільний (або netstat недоступний)");
}

console.log("\n=== Що робити далі ===\n");
console.log("1) cd до папки проєкту");
console.log("2) pnpm install        (якщо ще не робили)");
console.log("3) pnpm dev:unlock && pnpm dev");
console.log("4) У браузері:  http://localhost:3000/login");
console.log("   або:          http://127.0.0.1:3000/login");
console.log("5) Перевірка API: http://localhost:3000/api/health\n");
