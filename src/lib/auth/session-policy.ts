const DEFAULT_INACTIVITY_TIMEOUT_SECONDS = 60 * 60;
const DEFAULT_DAILY_REAUTH_SECONDS = 24 * 60 * 60;

function readPositiveIntEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return fallback;
  return Math.floor(value);
}

export const SESSION_POLICY = {
  inactivityTimeoutSeconds: readPositiveIntEnv(
    "AUTH_INACTIVITY_TIMEOUT_SECONDS",
    DEFAULT_INACTIVITY_TIMEOUT_SECONDS,
  ),
  dailyReauthSeconds: readPositiveIntEnv(
    "AUTH_DAILY_REAUTH_SECONDS",
    DEFAULT_DAILY_REAUTH_SECONDS,
  ),
} as const;

export function nowUnixSecondsSafe(): number {
  return Math.floor(Date.now() / 1000);
}

export function isSessionExpiredByPolicy(
  token: Record<string, unknown> | null | undefined,
): boolean {
  if (!token) return false;
  if (typeof token.sessionExpiredAt === "number") return true;

  const now = nowUnixSecondsSafe();
  const authenticatedAt =
    typeof token.authenticatedAt === "number" ? token.authenticatedAt : now;
  const lastActivityAt =
    typeof token.lastActivityAt === "number" ? token.lastActivityAt : now;

  return (
    now - authenticatedAt > SESSION_POLICY.dailyReauthSeconds ||
    now - lastActivityAt > SESSION_POLICY.inactivityTimeoutSeconds
  );
}
