"use client";

import Link from "next/link";
import { Inbox, MessageSquareText } from "lucide-react";
import { ConversationView } from "../../features/inbox/components/ConversationView";
import { ChannelBadge } from "../../features/inbox/components/ChannelBadge";
import type { InboxChannel } from "../../features/inbox/types";
import type { LeadMessengerThreadState } from "./useLeadMessengerThread";

/** Короткі підписи для селектора та підказки під полем вводу */
const channelLabel: Record<InboxChannel, string> = {
  telegram: "Telegram",
  instagram: "Instagram",
  whatsapp: "WhatsApp",
  viber: "Viber",
  sms: "SMS",
  email: "Пошта",
  webchat: "Веб-чат",
};

export function LeadMessengerPanel(state: LeadMessengerThreadState) {
  const {
    conv,
    availableChannels,
    selectedChannel,
    setSelectedChannel,
    err,
    sendErr,
    loading,
    handleNewMessage,
  } = state;

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-[var(--enver-card)] px-4 py-8 text-center text-xs text-slate-500 shadow-sm">
        Завантаження діалогу…
      </div>
    );
  }

  if (err) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-800 shadow-sm">
        {err}
      </div>
    );
  }

  if (!conv) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 gap-3">
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-sky-100 text-sky-700 ring-1 ring-sky-200/80"
            aria-hidden
          >
            <MessageSquareText className="h-5 w-5" strokeWidth={2} />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-[var(--enver-text)]">
              Чат з клієнтом
            </h2>
            <p className="mt-1 max-w-xl text-[12px] leading-relaxed text-slate-600">
              Канал відповіді задається в блоці нижче; текст вводиться в полі в
              кінці вікна переписки.
            </p>
          </div>
        </div>
        <Link
          href="/inbox"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-slate-200 bg-[var(--enver-card)] px-3 py-2 text-[11px] font-medium text-sky-900 shadow-sm transition hover:bg-[var(--enver-hover)]"
        >
          <Inbox className="h-3.5 w-3.5 opacity-80" />
          Усі звернення
        </Link>
      </div>

      {sendErr ? (
        <p
          className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] text-rose-800"
          role="alert"
        >
          {sendErr}
        </p>
      ) : null}

      <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-3 shadow-sm">
        <p className="text-[11px] font-medium text-slate-700">
          Канал відповіді
        </p>
        <p className="mt-0.5 text-[10px] text-slate-500">
          Канал вхідного звернення — у бейджі в шапці чату; тут лише канал
          вихідної відповіді.
        </p>
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="lead-outbound-channel">
            Канал відповіді
          </label>
          <select
            id="lead-outbound-channel"
            value={selectedChannel}
            onChange={(e) => setSelectedChannel(e.target.value as InboxChannel)}
            className="min-w-[160px] rounded-lg border border-slate-200 bg-[var(--enver-card)] px-2.5 py-2 text-[12px] font-medium text-slate-800 shadow-sm"
          >
            {(availableChannels.length > 0 ? availableChannels : ["webchat"]).map(
              (channel) => (
                <option key={channel} value={channel}>
                  {channelLabel[channel]}
                </option>
              ),
            )}
          </select>
          <ChannelBadge channel={selectedChannel} />
        </div>
      </div>

      <div className="flex min-h-[min(480px,70vh)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-[var(--enver-card)] shadow-sm">
        <ConversationView
          conversation={conv}
          onNewMessage={handleNewMessage}
          outboundChannelLabel={channelLabel[selectedChannel]}
        />
      </div>
    </div>
  );
}
