import { NextResponse } from "next/server";
import { resolveLeadTarget, storeInboundLeadMessage } from "../../../../../lib/messaging/inbound-lead-message";
import { appendUnlinkedInbound } from "../../../../../lib/messaging/unlinked-inbox-log";
import { seenInboundExternalId } from "../../../../../lib/messaging/webhook-security";
import { markChannelHealth } from "../../../../../lib/messaging/communications-health";
import { recordWorkflowEvent, WORKFLOW_EVENT_TYPES } from "@/features/event-system";

type TelegramWebhook = {
  update_id?: number;
  message?: {
    message_id?: number;
    date?: number;
    text?: string;
    from?: {
      username?: string;
    };
    chat?: {
      id?: number;
      username?: string;
    };
  };
};

export async function POST(req: Request) {
  const reqUrl = new URL(req.url);
  const ownerHint =
    reqUrl.searchParams.get("userId")?.trim() ||
    req.headers.get("x-enver-owner-id")?.trim() ||
    null;
  const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
  const providedSecret = req.headers.get("x-telegram-bot-api-secret-token")?.trim();
  if (expectedSecret && providedSecret !== expectedSecret) {
    return NextResponse.json({ error: "Invalid telegram secret" }, { status: 401 });
  }
  if (ownerHint) {
    await markChannelHealth({
      userId: ownerHint,
      channel: "telegram",
      type: "webhook",
    });
  }

  let payload: TelegramWebhook;
  try {
    payload = (await req.json()) as TelegramWebhook;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const message = payload.message;
  const text = message?.text?.trim() ?? "";
  if (!message || !text) {
    return NextResponse.json({ ok: true, ignored: "no_text_message" });
  }

  const username = message.from?.username ?? message.chat?.username ?? null;
  const target = await resolveLeadTarget({
    telegramUsername: username,
    ownerId: ownerHint,
  });
  const externalId =
    String(payload.update_id ?? "") + ":" + String(message.message_id ?? "");
  if (!target) {
    await appendUnlinkedInbound({
      channel: "telegram",
      text,
      externalId,
      from: username ?? "unknown",
      ownerUserId: ownerHint,
    });
    return NextResponse.json({ ok: true, ignored: "lead_not_found" });
  }
  if (await seenInboundExternalId({ leadId: target.leadId, channel: "TELEGRAM", externalId })) {
    return NextResponse.json({ ok: true, ignored: "duplicate" });
  }

  const occurredAt = message.date ? new Date(message.date * 1000) : undefined;
  await storeInboundLeadMessage({
    leadId: target.leadId,
    ownerId: target.ownerId,
    contactId: target.contactId,
    channel: "TELEGRAM",
    text,
    externalId,
    occurredAt,
    from: username ?? undefined,
  });
  await recordWorkflowEvent(
    WORKFLOW_EVENT_TYPES.TELEGRAM_MESSAGE_SYNCED,
    { leadId: target.leadId },
    {
      entityType: "LEAD",
      entityId: target.leadId,
      userId: target.ownerId,
      dedupeKey: `telegram-synced:${target.leadId}:${externalId}`,
    },
  );
  await markChannelHealth({
    userId: target.ownerId,
    channel: "telegram",
    type: "inbound",
  });

  return NextResponse.json({ ok: true });
}
