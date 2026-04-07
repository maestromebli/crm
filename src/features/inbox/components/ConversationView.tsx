"use client";

import type { InboxConversation } from "../types";
import { ChannelBadge } from "./ChannelBadge";
import { SlaBadge } from "./SlaBadge";
import { MessageBubble } from "./MessageBubble";
import { MessageComposer } from "./MessageComposer";

type ConversationViewProps = {
  conversation: InboxConversation | null;
  onNewMessage: (text: string) => void;
  /** Сховати шапку (наприклад, якщо зовнішній контейнер уже показує клієнта). */
  hideHeader?: boolean;
  /** Підпис каналу для поля вводу (куди піде відповідь). */
  outboundChannelLabel?: string;
};

export function ConversationView({
  conversation,
  onNewMessage,
  hideHeader = false,
  outboundChannelLabel,
}: ConversationViewProps) {
  if (!conversation) {
    return (
      <section className="flex flex-1 flex-col items-center justify-center border-x border-slate-200 bg-slate-50/80 text-xs text-slate-500">
        <p className="mb-1 text-sm font-medium text-slate-700">
          Виберіть діалог
        </p>
        <p className="max-w-xs text-center text-[11px] text-slate-500">
          Зліва — список усіх звернень з Telegram. Оберіть
          діалог, щоб побачити переписку та CRM‑контекст.
        </p>
      </section>
    );
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col border-x border-slate-200 bg-slate-50/60">
      {!hideHeader ? (
        <header className="flex items-center justify-between gap-3 border-b border-slate-200 bg-[var(--enver-card)]/90 px-3 py-2.5 text-xs">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-[var(--enver-text)]">
              {conversation.customerName}
            </p>
            <p className="truncate text-[11px] text-slate-500">
              {conversation.customerHandle}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-1.5">
              <ChannelBadge channel={conversation.channel} />
              <SlaBadge state={conversation.slaState} />
            </div>
            {conversation.linkedEntityLabel && (
              <p className="truncate text-[11px] text-slate-500">
                Привʼязано до:{" "}
                <span className="font-medium text-slate-800">
                  {conversation.linkedEntityLabel}
                </span>
              </p>
            )}
          </div>
        </header>
      ) : null}

      <div className="flex-1 space-y-2 overflow-y-auto px-3 py-3">
        {conversation.messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
      </div>

      <MessageComposer
        onSend={onNewMessage}
        outboundVia={outboundChannelLabel}
      />
    </section>
  );
}

