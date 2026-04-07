/**
 * Базовий URL застосунку для посилань у серверних обробниках (CSV, листи).
 * Спочатку беремо origin з поточного запиту (узгоджено з тим, що бачить користувач),
 * далі — NEXT_PUBLIC_APP_URL без завершального слеша.
 */
export function getPublicOriginFromRequest(req: Request): string {
  try {
    const u = new URL(req.url);
    if (u.origin && u.origin !== "null") return u.origin;
  } catch {
    /* ignore */
  }
  const env = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (env) return env.replace(/\/$/, "");
  return "";
}
