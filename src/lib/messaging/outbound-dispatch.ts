import type { InboxChannel } from "../../features/inbox/types";
import { prisma } from "../prisma";
import { getEffectiveCommunicationsConfigForUser } from "../settings/communications-settings-store";
import { markChannelHealth } from "./communications-health";
import { externalPostJson } from "../api/external-json";

type LeadContactLite = {
  phone: string | null;
  telegramHandle: string | null;
} | null;

type DispatchResult = {
  sent: boolean;
  providerMessageId?: string;
  delivery: "sent" | "failed";
  error?: string;
};

function digitsOnly(value: string): string {
  return value.replace(/\D+/g, "");
}

function normalizeTelegramChatId(contact: LeadContactLite): string | null {
  const tg = contact?.telegramHandle?.trim();
  if (!tg) return null;
  return tg.startsWith("@") ? tg : `@${tg}`;
}

function normalizePhone(phone: string | null): string | null {
  if (!phone) return null;
  const digits = digitsOnly(phone);
  if (!digits) return null;
  if (digits.startsWith("380")) return `+${digits}`;
  if (digits.length === 10) return `+38${digits}`;
  if (digits.startsWith("0") && digits.length === 10) return `+38${digits.slice(1)}`;
  return `+${digits}`;
}

function extractFrom(summary: string | null | undefined): string | null {
  if (!summary) return null;
  const m = summary.match(/\|from:([^|]+)/);
  return m?.[1]?.trim() || null;
}

async function sendTelegram(args: {
  text: string;
  contact: LeadContactLite;
  ownerUserId: string;
}): Promise<DispatchResult> {
  const cfg = await getEffectiveCommunicationsConfigForUser(args.ownerUserId);
  const tg = cfg.channels?.telegram;
  const token = tg?.botToken?.trim();
  if (!tg?.enabled || !token) {
    return { sent: false, delivery: "failed", error: "telegram_not_configured" };
  }
  const chatId = normalizeTelegramChatId(args.contact) ?? tg.channelId?.trim() ?? null;
  if (!chatId) {
    return { sent: false, delivery: "failed", error: "telegram_chat_missing" };
  }

  const res = await externalPostJson<{ ok?: boolean; result?: { message_id?: number } }>(
    `https://api.telegram.org/bot${token}/sendMessage`,
    { chat_id: chatId, text: args.text },
  );
  if (!res.ok || !res.data?.ok) {
    return { sent: false, delivery: "failed", error: "telegram_send_failed" };
  }
  return {
    sent: true,
    delivery: "sent",
    providerMessageId: res.data.result?.message_id
      ? String(res.data.result.message_id)
      : undefined,
  };
}

async function sendWhatsApp(args: {
  text: string;
  contact: LeadContactLite;
  ownerUserId: string;
}): Promise<DispatchResult> {
  const cfg = await getEffectiveCommunicationsConfigForUser(args.ownerUserId);
  const wa = cfg.channels?.whatsapp;
  const token = wa?.accessToken?.trim();
  const phoneNumberId = wa?.phoneNumberId?.trim();
  if (!wa?.enabled || !token || !phoneNumberId) {
    return { sent: false, delivery: "failed", error: "whatsapp_not_configured" };
  }
  const to = normalizePhone(args.contact?.phone ?? null);
  if (!to) {
    return { sent: false, delivery: "failed", error: "whatsapp_phone_missing" };
  }

  const apiBase = (wa.cloudApiUrl?.trim() || "https://graph.facebook.com/v20.0").replace(
    /\/$/,
    "",
  );
  const res = await externalPostJson<{ messages?: Array<{ id?: string }> }>(
    `${apiBase}/${phoneNumberId}/messages`,
    {
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body: args.text },
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );
  if (!res.ok) {
    return { sent: false, delivery: "failed", error: "whatsapp_send_failed" };
  }
  return {
    sent: true,
    delivery: "sent",
    providerMessageId: res.data?.messages?.[0]?.id,
  };
}

async function sendViber(args: {
  text: string;
  leadId: string;
  ownerUserId: string;
}): Promise<DispatchResult> {
  const cfg = await getEffectiveCommunicationsConfigForUser(args.ownerUserId);
  const vb = cfg.channels?.viber;
  const token = vb?.authToken?.trim();
  if (!vb?.enabled || !token) {
    return { sent: false, delivery: "failed", error: "viber_not_configured" };
  }

  const lastInbound = await prisma.leadMessage.findFirst({
    where: {
      leadId: args.leadId,
      channel: "VIBER",
      summary: { startsWith: "in|" },
    },
    orderBy: { createdAt: "desc" },
    select: { summary: true },
  });
  const receiver = extractFrom(lastInbound?.summary);
  if (!receiver) {
    return { sent: false, delivery: "failed", error: "viber_receiver_missing" };
  }

  const res = await externalPostJson<{ message_token?: number; status?: number }>(
    "https://chatapi.viber.com/pa/send_message",
    {
      receiver,
      type: "text",
      text: args.text,
    },
    {
      headers: {
        "X-Viber-Auth-Token": token,
      },
    },
  );
  if (!res.ok || (typeof res.data?.status === "number" && res.data.status !== 0)) {
    return { sent: false, delivery: "failed", error: "viber_send_failed" };
  }
  return {
    sent: true,
    delivery: "sent",
    providerMessageId:
      typeof res.data?.message_token === "number"
        ? String(res.data.message_token)
        : undefined,
  };
}

export async function dispatchOutboundLeadMessage(args: {
  leadId: string;
  ownerUserId: string;
  channel: InboxChannel;
  text: string;
  contact: LeadContactLite;
}): Promise<DispatchResult> {
  let result: DispatchResult;
  if (args.channel === "telegram") {
    result = await sendTelegram({
      text: args.text,
      contact: args.contact,
      ownerUserId: args.ownerUserId,
    });
  } else if (args.channel === "whatsapp") {
    result = await sendWhatsApp({
      text: args.text,
      contact: args.contact,
      ownerUserId: args.ownerUserId,
    });
  } else if (args.channel === "viber") {
    result = await sendViber({
      text: args.text,
      leadId: args.leadId,
      ownerUserId: args.ownerUserId,
    });
  } else {
    result = { sent: true, delivery: "sent" };
  }

  await markChannelHealth({
    userId: args.ownerUserId,
    channel: args.channel,
    type: result.delivery === "sent" ? "outbound_sent" : "outbound_failed",
    error: result.error,
  });
  return result;
}
