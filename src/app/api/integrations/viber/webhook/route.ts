import { NextResponse } from "next/server";
import {
  markLeadMessageDeliveryStatus,
  resolveLeadTarget,
  storeInboundLeadMessage,
} from "../../../../../lib/messaging/inbound-lead-message";
import { appendUnlinkedInbound } from "../../../../../lib/messaging/unlinked-inbox-log";
import { seenInboundExternalId } from "../../../../../lib/messaging/webhook-security";
import { prisma } from "../../../../../lib/prisma";
import { findUserIdByViberAuthToken } from "../../../../../lib/settings/communications-settings-store";
import { markChannelHealth } from "../../../../../lib/messaging/communications-health";

type ViberWebhookPayload = {
  event?: string;
  message_token?: number;
  user?: { id?: string; name?: string };
  sender?: { id?: string; name?: string };
  message?: {
    type?: string;
    text?: string;
  };
  status?: string;
  tracking_data?: string;
};

export async function POST(req: Request) {
  const expectedToken = process.env.VIBER_WEBHOOK_SECRET?.trim();
  const providedToken =
    req.headers.get("x-viber-auth-token")?.trim() ??
    req.headers.get("x-viber-signature")?.trim();
  const ownerUserIdFromToken = providedToken
    ? await findUserIdByViberAuthToken(providedToken)
    : null;
  const hasValidGlobalSecret = Boolean(expectedToken && providedToken === expectedToken);
  if (!hasValidGlobalSecret && !ownerUserIdFromToken) {
    return NextResponse.json({ error: "Invalid viber signature" }, { status: 401 });
  }
  if (ownerUserIdFromToken) {
    await markChannelHealth({
      userId: ownerUserIdFromToken,
      channel: "viber",
      type: "webhook",
    });
  }

  let payload: ViberWebhookPayload;
  try {
    payload = (await req.json()) as ViberWebhookPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (payload.event === "delivered" || payload.event === "seen" || payload.event === "failed") {
    const ext = String(payload.message_token ?? "").trim();
    if (!ext) return NextResponse.json({ ok: true });
    const match = await prisma.leadMessage.findFirst({
      where: { channel: "VIBER", summary: { contains: `ext:${ext}` } },
      select: { leadId: true },
    });
    if (!match) return NextResponse.json({ ok: true, ignored: "lead_not_found" });
    await markLeadMessageDeliveryStatus({
      leadId: match.leadId,
      channel: "VIBER",
      externalId: ext,
      status:
        payload.event === "seen"
          ? "read"
          : payload.event === "delivered"
            ? "delivered"
            : "failed",
    });
    const owner = await prisma.lead.findUnique({
      where: { id: match.leadId },
      select: { ownerId: true },
    });
    if (owner?.ownerId && payload.event === "failed") {
      await markChannelHealth({
        userId: owner.ownerId,
        channel: "viber",
        type: "delivery_failed",
        error: "delivery_failed",
      });
    }
    return NextResponse.json({ ok: true });
  }

  if (payload.event !== "message" || payload.message?.type !== "text") {
    return NextResponse.json({ ok: true, ignored: "unsupported_event" });
  }

  const text = payload.message.text?.trim() ?? "";
  const externalId = String(payload.message_token ?? "").trim();
  const from = payload.sender?.id?.trim() ?? payload.user?.id?.trim() ?? "";
  if (!text || !externalId || !from) {
    return NextResponse.json({ ok: true, ignored: "missing_fields" });
  }

  const target = await resolveLeadTarget({
    phone: from,
    ownerId: ownerUserIdFromToken,
  });
  if (!target) {
    await appendUnlinkedInbound({
      channel: "viber",
      text,
      externalId,
      from,
      ownerUserId: ownerUserIdFromToken,
    });
    return NextResponse.json({ ok: true, ignored: "lead_not_found" });
  }

  const duplicate = await seenInboundExternalId({
    leadId: target.leadId,
    channel: "VIBER",
    externalId,
  });
  if (duplicate) {
    return NextResponse.json({ ok: true, ignored: "duplicate" });
  }

  await storeInboundLeadMessage({
    leadId: target.leadId,
    ownerId: target.ownerId,
    contactId: target.contactId,
    channel: "VIBER",
    text,
    externalId,
    from,
  });
  await markChannelHealth({
    userId: target.ownerId,
    channel: "viber",
    type: "inbound",
  });

  return NextResponse.json({ ok: true });
}
