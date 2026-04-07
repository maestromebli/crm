/**
 * Знімає lock Next.js dev (якщо залишився після аварійного завершення).
 * Використання: pnpm dev:unlock
 */
import fs from "node:fs";
import path from "node:path";

const lock = path.join(process.cwd(), ".next", "dev", "lock");
try {
  if (fs.existsSync(lock)) {
    fs.rmSync(lock, { force: true });
    console.log("OK: видалено", lock);
  } else {
    console.log("Lock не знайдено — все добре:", lock);
  }
} catch (e) {
  console.error("Не вдалося видалити lock:", e);
  process.exit(1);
}
