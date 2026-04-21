"use client";

import type { InboxConversation } from "../types";
import { ChannelBadge } from "./ChannelBadge";
import { SlaBadge } from "./SlaBadge";
import { InboxAiSummary } from "./InboxAiSummary";

type ConversationSidebarProps = {
  conversation: InboxConversation | null;
};

export function ConversationSidebar({
  conversation,
}: ConversationSidebarProps) {
  if (!conversation) {
    return (
      <aside className="hidden w-72 flex-col gap-3 border-l border-slate-200 bg-slate-50/80 px-3 py-3 text-xs text-slate-500 lg:flex">
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">
          CRM панель
        </p>
        <p className="text-xs">
          Оберіть діалог зліва, щоб побачити інформацію про клієнта,
          повʼязані ліди, замовлення та наступні кроки.
        </p>
      </aside>
    );
  }

  return (
    <aside className="hidden w-72 flex-col gap-3 border-l border-slate-200 bg-slate-50/80 px-3 py-3 text-xs lg:flex">
      <div>
        <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">
          Клієнт
        </p>
        <p className="text-sm font-semibold text-[var(--enver-text)]">
          {conversation.customerName}
        </p>
        <p className="text-[11px] text-slate-500">
          {conversation.customerHandle}
        </p>
        <div className="mt-2 flex items-center gap-1.5">
          <ChannelBadge channel={conversation.channel} />
          <SlaBadge state={conversation.slaState} />
        </div>
      </div>

      <div className="space-y-1 rounded-2xl border border-slate-200 bg-[var(--enver-card)] px-3 py-2.5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          Статус діалогу
        </p>
        <p className="text-xs text-slate-600">
          {conversation.hasUnanswered
            ? "Очікує відповіді менеджера."
            : "Відповідь надіслана, очікуємо реакції клієнта."}
        </p>
      </div>

      <div className="space-y-1 rounded-2xl border border-slate-200 bg-[var(--enver-card)] px-3 py-2.5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          Повʼязані сутності
        </p>
        {conversation.linkedEntityLabel ? (
          <button
            type="button"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-100"
          >
            {conversation.linkedEntityLabel}
          </button>
        ) : (
          <p className="text-[11px] text-slate-500">
            Діалог ще не привʼязаний до ліда або замовлення.
          </p>
        )}
      </div>

      <div className="space-y-1 rounded-2xl border border-slate-200 bg-[var(--enver-card)] px-3 py-2.5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          Швидкі дії
        </p>
        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            className="rounded-lg bg-slate-900 px-2 py-1.5 text-[11px] font-medium text-slate-50 hover:bg-slate-800"
          >
            Створити лід
          </button>
          <button
            type="button"
            className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-[11px] text-slate-700 hover:bg-slate-100"
          >
            Привʼязати замовлення
          </button>
          <button
            type="button"
            className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-[11px] text-slate-700 hover:bg-slate-100"
          >
            Створити задачу
          </button>
          <button
            type="button"
            className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-[11px] text-slate-700 hover:bg-slate-100"
          >
            Створити подію
          </button>
        </div>
      </div>

      <div className="space-y-1 rounded-2xl border border-slate-200 bg-[var(--enver-card)] px-3 py-2.5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          AI-огляд
        </p>
        <InboxAiSummary conversation={conversation} />
      </div>
    </aside>
  );
}

