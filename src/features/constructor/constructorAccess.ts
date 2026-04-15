import { randomUUID } from "node:crypto";

export type ConstructorAccessTokenPayload = {
  orderId: string;
  constructorId?: string;
  expiresAt: string;
};

export function createConstructorSecureLink(baseUrl: string, payload: ConstructorAccessTokenPayload): string {
  const tokenBody = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const nonce = randomUUID().replace(/-/g, "");
  return `${baseUrl.replace(/\/$/, "")}/constructor/${nonce}.${tokenBody}`;
}

export function parseConstructorSecureToken(token: string): ConstructorAccessTokenPayload | null {
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    const decoded = Buffer.from(parts[1], "base64url").toString("utf8");
    const parsed = JSON.parse(decoded) as ConstructorAccessTokenPayload;
    if (!parsed.orderId || !parsed.expiresAt) return null;
    return parsed;
  } catch {
    return null;
  }
}
