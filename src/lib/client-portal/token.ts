import { createHmac, timingSafeEqual } from "node:crypto";

type PortalPayload = {
  dealId: string;
  exp: number;
};

function secret(): string {
  const value = process.env.CLIENT_PORTAL_TOKEN_SECRET?.trim();
  if (!value) {
    throw new Error("CLIENT_PORTAL_TOKEN_SECRET is not configured");
  }
  return value;
}

function b64(input: string): string {
  return Buffer.from(input, "utf8").toString("base64url");
}

function unb64(input: string): string {
  return Buffer.from(input, "base64url").toString("utf8");
}

function sign(part: string): string {
  return createHmac("sha256", secret()).update(part).digest("base64url");
}

export function createClientPortalToken(
  dealId: string,
  ttlHours = 24 * 30,
): string {
  const payload: PortalPayload = {
    dealId,
    exp: Date.now() + ttlHours * 60 * 60 * 1000,
  };
  const encoded = b64(JSON.stringify(payload));
  const signature = sign(encoded);
  return `${encoded}.${signature}`;
}

export function verifyClientPortalToken(token: string): PortalPayload | null {
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return null;
  const expected = sign(encoded);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(unb64(encoded)) as PortalPayload;
    if (!payload?.dealId || typeof payload.exp !== "number") return null;
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}
