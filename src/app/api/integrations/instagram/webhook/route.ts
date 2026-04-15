import { NextResponse } from "next/server";
import { appendUnlinkedInbound } from "@/lib/messaging/unlinked-inbox-log";
import {
  resolveLeadTarget,
  storeInboundLeadMessage,
} from "@/lib/messaging/inbound-lead-message";
import { getCommunicationsConfig } from "@/lib/settings/communications-settings-store";
import {
  seenInboundExternalId,
  verifyMetaSignature,
} from "@/lib/messaging/webhook-security";

type InstagramMessageEvent = {
  sender?: { id?: string; username?: string };
  recipient?: { id?: string };
  timestamp?: number;
  message?: { mid?: string; text?: string };
};

type InstagramWebhookPayload = {
  object?: string;
  entry?: Array<{
    id?: string;
    time?: number;
    messaging?: InstagramMessageEvent[];
  }>;
};

function parseTextEvents(payload: InstagramWebhookPayload): Array<{
  externalId: string;
  text: string;
  senderId: string;
  senderHandle?: string;
  occurredAt?: Date;
}> {
  const out: Array<{
    externalId: string;
    text: string;
    senderId: string;
    senderHandle?: string;
    occurredAt?: Date;
  }> = [];
  for (const entry of payload.entry ?? []) {
    for (const ev of entry.messaging ?? []) {
      const text = ev.message?.text?.trim() ?? "";
      const externalId = ev.message?.mid?.trim() ?? "";
      const senderId = ev.sender?.id?.trim() ?? "";
      if (!text || !externalId || !senderId) continue;
      out.push({
        externalId,
        text,
        senderId,
        senderHandle: ev.sender?.username?.trim() || undefined,
        occurredAt: typeof ev.timestamp === "number" ? new Date(ev.timestamp) : undefined,
      });
    }
  }
  return out;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  const cfg = await getCommunicationsConfig();
  const expected =
    cfg.channels?.instagram?.verifyToken?.trim() ||
    process.env.INSTAGRAM_VERIFY_TOKEN?.trim() ||
    "";
  if (mode === "subscribe" && expected && token === expected && challenge) {
    return new NextResponse(challenge, { status: 200 });
  }
  return NextResponse.json({ error: "Верифікацію не пройдено" }, { status: 403 });
}

export async function POST(req: Request) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-hub-signature-256");
  const cfg = await getCommunicationsConfig();
  const appSecret =
    cfg.channels?.facebook?.appSecret?.trim() || process.env.FACEBOOK_APP_SECRET;
  const validSignature = verifyMetaSignature({
    signatureHeader: signature,
    rawBody,
    appSecret,
  });
  if (!validSignature) {
    return NextResponse.json({ error: "Некоректний підпис" }, { status: 401 });
  }

  let payload: InstagramWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as InstagramWebhookPayload;
  } catch {
    return NextResponse.json({ error: "Некоректний JSON" }, { status: 400 });
  }

  const events = parseTextEvents(payload);
  for (const event of events) {
    const target = await resolveLeadTarget({
      instagramHandle: event.senderHandle ?? event.senderId,
    });
    if (!target) {
      await appendUnlinkedInbound({
        channel: "instagram",
        text: event.text,
        externalId: event.externalId,
        from: event.senderHandle ?? event.senderId,
      });
      continue;
    }
    const duplicate = await seenInboundExternalId({
      leadId: target.leadId,
      channel: "INSTAGRAM",
      externalId: event.externalId,
    });
    if (duplicate) continue;
    await storeInboundLeadMessage({
      leadId: target.leadId,
      ownerId: target.ownerId,
      contactId: target.contactId,
      channel: "INSTAGRAM",
      text: event.text,
      externalId: event.externalId,
      occurredAt: event.occurredAt,
      from: event.senderHandle ?? event.senderId,
    });
  }

  return NextResponse.json({ ok: true });
}
