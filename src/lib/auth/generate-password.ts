import { randomBytes } from "node:crypto";

/** Криптостійкий пароль для видачі адміном (base64url, без неоднозначних символів у друці). */
export function generateSecurePassword(length = 14): string {
  const min = Math.max(10, Math.min(64, length));
  return randomBytes(Math.ceil((min * 3) / 4))
    .toString("base64url")
    .slice(0, min);
}
