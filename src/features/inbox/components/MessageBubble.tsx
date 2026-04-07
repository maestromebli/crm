"use client";

import type { InboxMessage } from "../types";
import { cn } from "../../../lib/utils";

type MessageBubbleProps = {
  message: InboxMessage;
};

export function MessageBubble({ message }: MessageBubbleProps) {
  if (message.direction === "system") {
    return (
      <div className="my-2 flex justify-center">
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">
          {message.text}
        </span>
      </div>
    );
  }

  const isIncoming = message.direction === "in";
  const deliveryLabel =
    message.deliveryStatus === "read"
      ? "Прочитано"
      : message.deliveryStatus === "delivered"
        ? "Доставлено"
        : message.deliveryStatus === "failed"
          ? "Помилка"
          : message.deliveryStatus === "sent"
            ? "Надіслано"
            : null;

  return (
    <div
      className={cn(
        "mb-1 flex",
        isIncoming ? "justify-start" : "justify-end",
      )}
    >
      <div
        className={cn(
          "max-w-[75%] rounded-2xl px-3 py-2 text-xs shadow-sm",
          isIncoming
            ? "bg-[var(--enver-card)] text-[var(--enver-text)]"
            : "bg-slate-900 text-slate-50",
        )}
      >
        <p className="whitespace-pre-wrap text-[13px] leading-relaxed">
          {message.text}
        </p>
        {message.createdAt && (
          <p
            className={cn(
              "mt-1 text-[10px]",
              isIncoming ? "text-slate-400" : "text-slate-300/80",
            )}
          >
            {message.createdAt}
            {!isIncoming && deliveryLabel ? ` · ${deliveryLabel}` : ""}
          </p>
        )}
      </div>
    </div>
  );
}

