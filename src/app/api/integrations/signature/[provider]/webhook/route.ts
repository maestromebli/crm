import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import type { EnverSignatureStatus } from "@prisma/client";
import { syncSignatureStatus } from "@/features/contracts/services/sync-signature-status";
import { prisma } from "@/lib/prisma";

function normalizeStatus(payload: Record<string, unknown>): EnverSignatureStatus {
  const raw = String(payload.status ?? payload.event ?? "").toUpperCase();
  switch (raw) {
    case "SENT":
      return "LINK_SENT";
    case "OPENED":
      return "OPENED";
    case "IDENTIFIED":
      return "IDENTIFIED";
    case "IN_PROGRESS":
      return "SIGNING_IN_PROGRESS";
    case "SIGNED":
      return "SIGNED";
    case "FAILED":
      return "FAILED";
    case "CANCELLED":
      return "CANCELLED";
    case "EXPIRED":
      return "EXPIRED";
    default:
      return "NOT_STARTED";
  }
}

function safeCompare(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function resolveWebhookSecret(provider: string): string {
  const normalized = provider.trim().toUpperCase();
  return (
    process.env[`${normalized}_WEBHOOK_SECRET`] ??
    process.env.SIGNATURE_WEBHOOK_SECRET ??
    ""
  ).trim();
}

function verifyWebhookSecret(req: NextRequest, provider: string): NextResponse | null {
  const configured = resolveWebhookSecret(provider);
  if (!configured) {
    return NextResponse.json(
      { error: "WEBHOOK_SECRET_NOT_CONFIGURED" },
      { status: 503 },
    );
  }

  const incoming =
    req.headers.get("x-signature-webhook-secret")?.trim() ??
    req.headers.get("x-webhook-secret")?.trim() ??
    "";
  if (!incoming || !safeCompare(configured, incoming)) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }
  return null;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params;
  const denied = verifyWebhookSecret(req, provider);
  if (denied) return denied;

  const payload = (await req.json()) as Record<string, unknown>;
  const envelopeId = String(payload.envelopeId ?? payload.id ?? "");
  if (!envelopeId) {
    return NextResponse.json({ error: "MISSING_ENVELOPE_ID" }, { status: 400 });
  }

  await syncSignatureStatus({
    prisma,
    provider: provider.toUpperCase(),
    envelopeId,
    normalizedStatus: normalizeStatus(payload),
    rawPayload: payload,
  });

  return NextResponse.json({ ok: true });
}
