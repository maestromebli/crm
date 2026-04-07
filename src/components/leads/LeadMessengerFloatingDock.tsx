"use client";

import { MessageCircle, Minimize2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ConversationView } from "../../features/inbox/components/ConversationView";
import { ChannelBadge } from "../../features/inbox/components/ChannelBadge";
import { SlaBadge } from "../../features/inbox/components/SlaBadge";
import type { InboxChannel } from "../../features/inbox/types";
import { cn } from "../../lib/utils";
import type { LeadMessengerThreadState } from "./useLeadMessengerThread";

const channelLabel: Record<InboxChannel, string> = {
  telegram: "Telegram",
  instagram: "Instagram",
  whatsapp: "WhatsApp",
  viber: "Viber",
  sms: "SMS",
  email: "Пошта",
  webchat: "Веб-чат",
};

function dockStorageKey(leadId: string) {
  return `lead-messenger-dock-open:${leadId}`;
}

type Props = LeadMessengerThreadState;

export function LeadMessengerFloatingDock(state: Props) {
  const {
    leadId,
    conv,
    availableChannels,
    selectedChannel,
    setSelectedChannel,
    err,
    sendErr,
    loading,
    handleNewMessage,
  } = state;

  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const v = sessionStorage.getItem(dockStorageKey(leadId));
      if (v === "1") setOpen(true);
    } catch {
      /* ignore */
    }
  }, [leadId]);

  const setOpenPersist = useCallback(
    (next: boolean) => {
      setOpen(next);
      try {
        sessionStorage.setItem(dockStorageKey(leadId), next ? "1" : "0");
      } catch {
        /* ignore */
      }
    },
    [leadId],
  );

  if (!mounted || loading || err || !conv) {
    return null;
  }

  const dock = (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-end gap-2 p-3 md:p-4">
      {open ? (
        <div
          className={cn(
            "pointer-events-auto flex h-[min(520px,calc(100vh-5rem))] w-[min(100vw-1.5rem,380px)] flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-[var(--enver-card)] shadow-[0_8px_40px_rgba(15,23,42,0.18)]",
          )}
          role="dialog"
          aria-labelledby="lead-chat-dock-title"
          aria-describedby="lead-chat-dock-hint"
        >
          <div className="flex items-start justify-between gap-2 border-b border-slate-200/80 bg-gradient-to-r from-[#2563EB] to-[#1D4ED8] px-3 py-2.5 text-white">
            <div className="min-w-0">
              <p
                id="lead-chat-dock-hint"
                className="text-[10px] font-medium uppercase tracking-wide text-white/80"
              >
                Швидкий чат
              </p>
              <p
                id="lead-chat-dock-title"
                className="truncate text-sm font-semibold leading-tight"
              >
                {conv.customerName}
              </p>
              <p className="truncate text-[11px] text-white/85">
                {conv.customerHandle}
              </p>
              <p className="mt-1 text-[10px] text-white/75">
                Вікно закріплене внизу екрана; сторінку можна прокручувати
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] text-white/80">Канал звернення:</span>
                <ChannelBadge channel={conv.channel} />
                <SlaBadge state={conv.slaState} />
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpenPersist(false)}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25"
              title="Згорнути вікно"
              aria-label="Згорнути вікно чату"
            >
              <Minimize2 className="h-4 w-4" strokeWidth={2.25} />
            </button>
          </div>
          {sendErr ? (
            <p
              className="border-b border-rose-100 bg-rose-50 px-3 py-2 text-[11px] text-rose-800"
              role="alert"
            >
              {sendErr}
            </p>
          ) : null}
          <div className="border-b border-slate-100 bg-slate-50/90 px-3 py-2.5">
            <p className="text-[11px] font-medium text-slate-700">
              Канал відповіді
            </p>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <label className="sr-only" htmlFor="lead-chat-dock-channel">
                Канал відповіді
              </label>
              <select
                id="lead-chat-dock-channel"
                value={selectedChannel}
                onChange={(e) =>
                  setSelectedChannel(e.target.value as InboxChannel)
                }
                className="max-w-[220px] flex-1 rounded-lg border border-slate-200 bg-[var(--enver-card)] px-2 py-1.5 text-[12px] font-medium text-slate-800"
              >
                {(availableChannels.length > 0
                  ? availableChannels
                  : ["webchat"]
                ).map((channel) => (
                  <option key={channel} value={channel}>
                    {channelLabel[channel]}
                  </option>
                ))}
              </select>
              <ChannelBadge channel={selectedChannel} />
            </div>
          </div>
          <div className="flex min-h-0 flex-1 flex-col">
            <ConversationView
              conversation={conv}
              onNewMessage={handleNewMessage}
              hideHeader
              outboundChannelLabel={channelLabel[selectedChannel]}
            />
          </div>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setOpenPersist(!open)}
        className={cn(
          "pointer-events-auto flex items-center gap-2 rounded-full bg-[#2563EB] pl-3.5 pr-3 text-white shadow-lg shadow-slate-900/25 transition hover:bg-[#1D4ED8] hover:shadow-xl sm:pl-4",
          open ? "py-2.5" : "py-3",
          open && "ring-2 ring-white/90",
        )}
        title={open ? "Згорнути" : "Швидкий чат"}
        aria-expanded={open}
        aria-label={
          open ? "Згорнути діалог з клієнтом" : "Відкрити діалог з клієнтом"
        }
      >
        <MessageCircle className="h-6 w-6 shrink-0 sm:h-7 sm:w-7" strokeWidth={1.75} />
        <span className="hidden max-w-[120px] truncate text-sm font-semibold sm:inline">
          {open ? "Згорнути" : "Чат"}
        </span>
      </button>
    </div>
  );

  return createPortal(dock, document.body);
}
