export type InboxChannel =
  | "telegram"
  | "instagram"
  | "whatsapp"
  | "viber"
  | "sms"
  | "email"
  | "webchat";

export type InboxStatus =
  | "open"
  | "waiting_client"
  | "resolved"
  | "snoozed";

export type InboxSlaState = "ok" | "warning" | "overdue";

export type InboxLinkedEntityType =
  | "lead"
  | "contact"
  | "deal"
  | "none";

export type InboxMessage = {
  id: string;
  direction: "in" | "out" | "system";
  text: string;
  createdAt: string;
  deliveryStatus?: "sent" | "delivered" | "read" | "failed";
};

export type InboxConversation = {
  id: string;
  customerName: string;
  customerHandle: string;
  channel: InboxChannel;
  lastMessagePreview: string;
  lastMessageAt: string;
  unreadCount: number;
  hasUnanswered: boolean;
  slaState: InboxSlaState;
  status: InboxStatus;
  assignee?: string;
  linkedEntityType: InboxLinkedEntityType;
  linkedEntityLabel?: string;
  messages: InboxMessage[];
};

