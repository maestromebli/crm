"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { Textarea } from "../../../components/ui/textarea";
import { cn } from "../../../lib/utils";

type MessageComposerProps = {
  onSend: (text: string) => void;
  /** Канал вихідної відповіді (як у селекторі зверху). */
  outboundVia?: string;
};

export function MessageComposer({ onSend, outboundVia }: MessageComposerProps) {
  const [value, setValue] = useState("");
  const [sending, setSending] = useState(false);

  const handleSend = () => {
    const trimmed = value.trim();
    if (!trimmed || sending) return;
    setSending(true);
    onSend(trimmed);
    setValue("");
    setSending(false);
  };

  return (
    <div className="border-t border-slate-200 bg-[var(--enver-card)]/95 px-3 py-2.5">
      {outboundVia ? (
        <p className="mb-2 text-[10px] leading-snug text-slate-500">
          Вихідне повідомлення через{" "}
          <span className="font-medium text-slate-700">{outboundVia}</span>
        </p>
      ) : null}
      <div className="flex items-end gap-2">
        <div className="min-w-0 flex-1">
          <Textarea
            rows={2}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Введіть текст відповіді…"
            className="text-xs"
            onKeyDown={(e) => {
              if (e.key !== "Enter" || e.shiftKey) return;
              e.preventDefault();
              handleSend();
            }}
          />
        </div>
        <button
          type="button"
          onClick={handleSend}
          disabled={!value.trim() || sending}
          title="Надіслати"
          aria-label="Надіслати повідомлення"
          className={cn(
            "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-900 text-slate-50 shadow-sm shadow-slate-900/40 transition hover:bg-slate-800",
            (!value.trim() || sending) &&
              "cursor-not-allowed opacity-50 hover:bg-slate-900",
          )}
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
      <p className="mt-1.5 text-[10px] text-slate-400">
        Enter — надіслати; Shift+Enter — перенесення рядка
      </p>
    </div>
  );
}

