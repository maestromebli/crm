import { NextResponse } from "next/server";
import {
  markLeadMessageDeliveryStatus,
  resolveLeadTarget,
  storeInboundLeadMessage,
} from "../../../../../lib/messaging/inbound-lead-message";
import { appendUnlinkedInbound } from "../../../../../lib/messaging/unlinked-inbox-log";
import {
  seenInboundExternalId,
  verifyMetaSignature,
} from "../../../../../lib/messaging/webhook-security";
import { prisma } from "../../../../../lib/prisma";
import { findUserIdByWhatsappPhoneNumberId } from "../../../../../lib/settings/communications-settings-store";
import { markChannelHealth } from "../../../../../lib/messaging/communications-health";

type WhatsAppMessage = {
  id?: string;
  from?: string;
  timestamp?: string;
  text?: { body?: string };
  type?: string;
};

type WhatsAppPayload = {
  entry?: Array<{
    changes?: Array<{
      value?: {
        messages?: WhatsAppMessage[];
        metadata?: {
          phone_number_id?: string;
        };
        statuses?: Array<{
          id?: string;
          status?: string;
          recipient_id?: string;
        }>;
      };
    }>;
  }>;
};

export async function GET(req: Request) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  const expected = process.env.WHATSAPP_VERIFY_TOKEN?.trim();

  if (mode === "subscribe" && expected && token === expected && challenge) {
    return new NextResponse(challenge, { status: 200 });
  }
  return NextResponse.json({ error: "Верифікацію не пройдено" }, { status: 403 });
}

export async function POST(req: Request) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-hub-signature-256");
  const validSignature = verifyMetaSignature({
    signatureHeader: signature,
    rawBody,
    appSecret: process.env.WHATSAPP_APP_SECRET,
  });
  if (!validSignature) {
    return NextResponse.json({ error: "Некоректний підпис" }, { status: 401 });
  }

  let payload: WhatsAppPayload;
  try {
    payload = JSON.parse(rawBody) as WhatsAppPayload;
  } catch {
    return NextResponse.json({ error: "Некоректний JSON" }, { status: 400 });
  }

  const incoming: WhatsAppMessage[] = [];
  let destinationPhoneNumberId: string | null = null;
  const statuses: Array<{ id: string; status: string }> = [];
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (!destinationPhoneNumberId) {
        destinationPhoneNumberId = change.value?.metadata?.phone_number_id?.trim() ?? null;
      }
      for (const msg of change.value?.messages ?? []) {
        incoming.push(msg);
      }
      for (const st of change.value?.statuses ?? []) {
        if (!st.id?.trim() || !st.status?.trim()) continue;
        statuses.push({ id: st.id.trim(), status: st.status.trim() });
      }
    }
  }
  const ownerUserId = destinationPhoneNumberId
    ? await findUserIdByWhatsappPhoneNumberId(destinationPhoneNumberId)
    : null;
  if (ownerUserId) {
    await markChannelHealth({
      userId: ownerUserId,
      channel: "whatsapp",
      type: "webhook",
    });
  }

  for (const st of statuses) {
    const normalized =
      st.status === "read"
        ? "read"
        : st.status === "delivered"
          ? "delivered"
          : st.status === "failed"
            ? "failed"
            : "sent";
    const match = await prisma.leadMessage.findFirst({
      where: {
        channel: "WHATSAPP",
        summary: { contains: `ext:${st.id}` },
      },
      select: { leadId: true },
    });
    if (!match) continue;
    await markLeadMessageDeliveryStatus({
      leadId: match.leadId,
      channel: "WHATSAPP",
      externalId: st.id,
      status: normalized,
    });
    const owner = await prisma.lead.findUnique({
      where: { id: match.leadId },
      select: { ownerId: true },
    });
    if (owner?.ownerId && normalized === "failed") {
      await markChannelHealth({
        userId: owner.ownerId,
        channel: "whatsapp",
        type: "delivery_failed",
        error: "delivery_failed",
      });
    }
  }

  for (const msg of incoming) {
    if (msg.type !== "text") continue;
    const text = msg.text?.body?.trim() ?? "";
    const from = msg.from?.trim() ?? "";
    const externalId = msg.id?.trim() ?? "";
    if (!text || !from || !externalId) continue;

    const target = await resolveLeadTarget({ phone: from, ownerId: ownerUserId });
    if (!target) {
      await appendUnlinkedInbound({
        channel: "whatsapp",
        text,
        externalId,
        from,
        ownerUserId,
      });
      continue;
    }

    const duplicate = await seenInboundExternalId({
      leadId: target.leadId,
      channel: "WHATSAPP",
      externalId,
    });
    if (duplicate) continue;

    const occurredAt = msg.timestamp
      ? new Date(Number(msg.timestamp) * 1000)
      : undefined;
    await storeInboundLeadMessage({
      leadId: target.leadId,
      ownerId: target.ownerId,
      contactId: target.contactId,
      channel: "WHATSAPP",
      text,
      externalId,
      occurredAt,
      from,
    });
    if (target.ownerId) {
      await markChannelHealth({
        userId: target.ownerId,
        channel: "whatsapp",
        type: "inbound",
      });
    }
  }

  return NextResponse.json({ ok: true });
}
