import { format } from "date-fns";
import { uk } from "date-fns/locale";
import type {
  InboxChannel,
  InboxConversation,
  InboxMessage,
} from "../../features/inbox/types";

const MESSENGER_CHANNELS = new Set([
  "TELEGRAM",
  "INSTAGRAM",
  "WHATSAPP",
  "VIBER",
  "SMS",
  "EMAIL",
  "WEBCHAT",
]);

export function isMessengerChannel(channel: string): boolean {
  return MESSENGER_CHANNELS.has(channel.toUpperCase());
}

export function messengerSummaryDirection(
  summary: string | null | undefined,
): "in" | "out" {
  if (summary?.startsWith("in|")) return "in";
  return "out";
}

export function messengerSummaryDeliveryStatus(
  summary: string | null | undefined,
): "sent" | "delivered" | "read" | "failed" | undefined {
  if (!summary) return undefined;
  const m = summary.match(/\|delivery:([^|]+)/);
  const status = m?.[1]?.trim();
  if (
    status === "sent" ||
    status === "delivered" ||
    status === "read" ||
    status === "failed"
  ) {
    return status;
  }
  return undefined;
}

export function formatMessengerTime(iso: string): string {
  try {
    return format(new Date(iso), "d MMM yyyy, HH:mm", { locale: uk });
  } catch {
    return iso;
  }
}

export function mapRowsToInboxMessages(
  rows: Array<{
    id: string;
    body: string;
    summary: string | null;
    createdAt: Date;
  }>,
): InboxMessage[] {
  return rows.map((r) => ({
    id: r.id,
    text: r.body,
    direction: messengerSummaryDirection(r.summary),
    createdAt: formatMessengerTime(r.createdAt.toISOString()),
    deliveryStatus: messengerSummaryDeliveryStatus(r.summary),
  }));
}

type LeadContactLite = {
  fullName: string | null;
  phone: string | null;
  email: string | null;
  telegramHandle: string | null;
  instagramHandle: string | null;
} | null;

export function resolveLeadMessengerChannel(
  contact: LeadContactLite,
): InboxChannel {
  if (contact?.telegramHandle?.trim()) return "telegram";
  if (contact?.instagramHandle?.trim()) return "instagram";
  if (contact?.phone?.trim()) return "whatsapp";
  if (contact?.email?.trim()) return "email";
  return "webchat";
}

export function availableLeadMessengerChannels(
  contact: LeadContactLite,
): InboxChannel[] {
  const channels: InboxChannel[] = [];
  if (contact?.telegramHandle?.trim()) channels.push("telegram");
  if (contact?.instagramHandle?.trim()) channels.push("instagram");
  if (contact?.phone?.trim()) channels.push("whatsapp", "viber", "sms");
  if (contact?.email?.trim()) channels.push("email");
  channels.push("webchat");
  return channels;
}

export function prismaChannelForInbox(channel: InboxChannel): string {
  if (channel === "telegram") return "TELEGRAM";
  if (channel === "instagram") return "INSTAGRAM";
  if (channel === "whatsapp") return "WHATSAPP";
  if (channel === "viber") return "VIBER";
  if (channel === "sms") return "SMS";
  if (channel === "email") return "EMAIL";
  return "WEBCHAT";
}

export function inboxChannelFromPrisma(channel: string): InboxChannel {
  const normalized = channel.toUpperCase();
  if (normalized === "TELEGRAM") return "telegram";
  if (normalized === "INSTAGRAM") return "instagram";
  if (normalized === "WHATSAPP") return "whatsapp";
  if (normalized === "VIBER") return "viber";
  if (normalized === "SMS") return "sms";
  if (normalized === "EMAIL") return "email";
  return "webchat";
}

export function buildCustomerHandle(contact: LeadContactLite): string {
  if (contact?.telegramHandle?.trim()) {
    const h = contact.telegramHandle.trim();
    return h.startsWith("@") ? h : `@${h}`;
  }
  if (contact?.instagramHandle?.trim()) {
    const h = contact.instagramHandle.trim();
    return h.startsWith("@") ? h : `@${h}`;
  }
  if (contact?.phone?.trim()) return contact.phone.trim();
  if (contact?.email?.trim()) return contact.email.trim();
  return "—";
}

export function buildLeadMessengerConversation(args: {
  leadId: string;
  leadTitle: string;
  contact: LeadContactLite;
  messages: InboxMessage[];
  /** ISO час останнього повідомлення (для превʼю). */
  lastMessageAtIso?: string | null;
}): InboxConversation {
  const channel = resolveLeadMessengerChannel(args.contact);
  const name =
    args.contact?.fullName?.trim() ||
    args.leadTitle ||
    "Клієнт";
  const lastText = args.messages[args.messages.length - 1]?.text;
  return {
    id: `lead-${args.leadId}`,
    customerName: name,
    customerHandle: buildCustomerHandle(args.contact),
    channel,
    lastMessagePreview:
      lastText != null
        ? lastText.length > 160
          ? `${lastText.slice(0, 157)}…`
          : lastText
        : "Ще немає повідомлень",
    lastMessageAt:
      args.lastMessageAtIso ?? new Date().toISOString(),
    unreadCount: 0,
    hasUnanswered: false,
    slaState: "ok",
    status: "open",
    linkedEntityType: "lead",
    linkedEntityLabel: args.leadTitle,
    messages: args.messages,
  };
}
