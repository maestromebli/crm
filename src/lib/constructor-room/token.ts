import { randomBytes } from "crypto";

export function newConstructorPublicToken(): string {
  return randomBytes(24).toString("base64url").replace(/=+$/, "");
}
