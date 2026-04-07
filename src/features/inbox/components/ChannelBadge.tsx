"use client";

import type React from "react";
import { MessageCircle, Send, Mail, Globe2, Phone, MessageSquare } from "lucide-react";
import type { InboxChannel } from "../types";

type ChannelBadgeProps = {
  channel: InboxChannel;
};

const channelConfig: Record<
  InboxChannel,
  { label: string; icon: React.ElementType; className: string }
> = {
  telegram: {
    label: "Telegram",
    icon: Send,
    className: "bg-sky-50 text-sky-700 border-sky-100",
  },
  instagram: {
    label: "Instagram",
    icon: MessageCircle,
    className: "bg-pink-50 text-pink-700 border-pink-100",
  },
  whatsapp: {
    label: "WhatsApp",
    icon: MessageSquare,
    className: "bg-emerald-50 text-emerald-700 border-emerald-100",
  },
  viber: {
    label: "Viber",
    icon: MessageCircle,
    className: "bg-violet-50 text-violet-700 border-violet-100",
  },
  sms: {
    label: "SMS",
    icon: Phone,
    className: "bg-amber-50 text-amber-700 border-amber-100",
  },
  email: {
    label: "Пошта",
    icon: Mail,
    className: "bg-emerald-50 text-emerald-700 border-emerald-100",
  },
  webchat: {
    label: "Веб-чат",
    icon: Globe2,
    className: "bg-violet-50 text-violet-700 border-violet-100",
  },
};

export function ChannelBadge({ channel }: ChannelBadgeProps) {
  const cfg = channelConfig[channel];
  const Icon = cfg.icon;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${cfg.className}`}
    >
      <Icon className="h-3 w-3" />
      {cfg.label}
    </span>
  );
}

