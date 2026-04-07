import fs from "fs";
import path from "path";
import { config as loadEnv } from "dotenv";

/**
 * Завантажує .env з кореня проєкту навіть якщо `process.cwd()` інший (наприклад підпроєкт).
 * Викликати один раз на старті модулів, що читають DATABASE_URL.
 */
export function loadProjectEnv(): void {
  const tried = new Set<string>();
  const roots = [process.cwd()];
  const parent = path.resolve(process.cwd(), "..");
  if (fs.existsSync(path.join(parent, "prisma", "schema.prisma"))) {
    roots.push(parent);
  }

  for (const root of roots) {
    for (const name of [".env", ".env.local"] as const) {
      const full = path.join(root, name);
      if (tried.has(full) || !fs.existsSync(full)) continue;
      tried.add(full);
      loadEnv({ path: full, override: name === ".env.local" });
    }
  }
}
