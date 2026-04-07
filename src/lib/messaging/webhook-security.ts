import { createHmac, timingSafeEqual } from "node:crypto";
import { prisma } from "../prisma";

function safeCompare(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function verifyMetaSignature(args: {
  signatureHeader: string | null;
  rawBody: string;
  appSecret?: string;
}): boolean {
  const secret = args.appSecret?.trim();
  if (!secret) return true;
  if (!args.signatureHeader?.startsWith("sha256=")) return false;
  const expected =
    "sha256=" + createHmac("sha256", secret).update(args.rawBody).digest("hex");
  return safeCompare(expected, args.signatureHeader.trim());
}

export async function seenInboundExternalId(args: {
  leadId: string;
  channel: string;
  externalId: string;
}): Promise<boolean> {
  const marker = `ext:${args.externalId}`;
  const existing = await prisma.leadMessage.findFirst({
    where: {
      leadId: args.leadId,
      channel: args.channel,
      summary: { contains: marker },
    },
    select: { id: true },
  });
  return Boolean(existing);
}
