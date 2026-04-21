import { config as loadEnv } from "dotenv";

/**
 * Завантажує .env з кореня проєкту навіть якщо `process.cwd()` інший (наприклад підпроєкт).
 * Викликати один раз на старті модулів, що читають DATABASE_URL.
 */
export function loadProjectEnv(): void {
  loadEnv({ path: ".env" });
  loadEnv({ path: ".env.local", override: true });
}
