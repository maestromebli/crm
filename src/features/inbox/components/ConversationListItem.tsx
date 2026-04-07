"use client";

import type React from "react";
import type { InboxConversation } from "../types";
import { ChannelBadge } from "./ChannelBadge";
import { SlaBadge } from "./SlaBadge";
import { cn } from "../../../lib/utils";

type ConversationListItemProps = {
  item: InboxConversation;
  active: boolean;
  onSelect: () => void;
};

export function ConversationListItem({
  item,
  active,
  onSelect,
}: ConversationListItemProps) {
  const unread = item.unreadCount > 0;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "w-full rounded-2xl border px-3 py-2.5 text-left text-xs transition",
        active
          ? "border-slate-900 bg-slate-900 text-slate-50 shadow-sm shadow-slate-900/40"
          : "border-slate-200 bg-[var(--enver-card)]/90 text-slate-800 hover:border-slate-300 hover:bg-[var(--enver-hover)]",
      )}
    >
      <div className="mb-1 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="truncate text-[13px] font-medium">
            {item.customerName}
          </span>
          {unread ? (
            <span className="inline-flex h-4 min-w-[1.2rem] items-center justify-center rounded-full bg-slate-900 text-[10px] font-semibold text-slate-50">
              {item.unreadCount}
            </span>
          ) : null}
        </div>
        <span
          className={cn(
            "whitespace-nowrap text-[10px]",
            active ? "text-slate-100/80" : "text-slate-400",
          )}
        >
          {item.lastMessageAt}
        </span>
      </div>

      <div className="mb-1 line-clamp-1 text-[11px] text-slate-500">
        {item.lastMessagePreview}
      </div>

      <div className="flex items-center justify-between gap-2 pt-1">
        <div className="flex items-center gap-1.5">
          <ChannelBadge channel={item.channel} />
          {item.linkedEntityLabel && (
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium",
                active
                  ? "bg-slate-800/70 text-slate-50"
                  : "bg-slate-100 text-slate-700",
              )}
            >
              {item.linkedEntityLabel}
            </span>
          )}
        </div>
        <SlaBadge state={item.slaState} />
      </div>
    </button>
  );
}

