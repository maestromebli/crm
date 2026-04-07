"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { Bot, Check, Copy, Loader2, User } from "lucide-react";
import { cn } from "../../../lib/utils";
import type { AssistantChatMessage } from "../hooks/useAssistantChat";
import {
  AssistantMessageBody,
  AssistantToolBadges,
} from "./AssistantMessageBody";

type Props = {
  messages: AssistantChatMessage[];
  loading: boolean;
  error: string | null;
  emptyHint: string;
};

export function AssistantChatThread({
  messages,
  loading,
  error,
  emptyHint,
}: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading, error, scrollToBottom]);

  const copyMessage = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      window.setTimeout(() => setCopiedId(null), 2000);
    } catch {
      /* ignore */
    }
  };

  return (
    <div
      className={cn(
        "min-h-[128px] flex-1 space-y-3 overflow-y-auto overscroll-contain px-3 py-2",
        "[scrollbar-width:thin] [scrollbar-color:rgba(148,163,184,0.5)_transparent]",
      )}
      role="log"
      aria-live="polite"
      aria-relevant="additions"
    >
      {messages.length === 0 && !loading ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200/90 bg-white/60 px-4 py-8 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-violet-100 to-indigo-50 text-violet-600 shadow-inner">
            <Bot className="h-5 w-5" strokeWidth={1.75} />
          </div>
          <p className="max-w-[280px] text-[12px] leading-relaxed text-slate-600">
            {emptyHint}
          </p>
        </div>
      ) : null}

      {messages.map((m) => (
        <div
          key={m.id}
          className={cn(
            "flex gap-2.5",
            m.role === "user" ? "flex-row-reverse" : "flex-row",
          )}
        >
          <div
            className={cn(
              "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl shadow-sm",
              m.role === "user"
                ? "bg-slate-700 text-white"
                : "bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-violet-500/20",
            )}
            aria-hidden
          >
            {m.role === "user" ? (
              <User className="h-3.5 w-3.5" strokeWidth={2} />
            ) : (
              <Bot className="h-3.5 w-3.5" strokeWidth={2} />
            )}
          </div>

          <div
            className={cn(
              "min-w-0 max-w-[calc(100%-2.75rem)] rounded-2xl px-3.5 py-2.5 shadow-sm",
              m.role === "user"
                ? "rounded-br-md bg-slate-800 text-white"
                : "rounded-bl-md border border-violet-100/90 bg-gradient-to-b from-white to-violet-50/40 text-slate-800",
            )}
          >
            <p
              className={cn(
                "mb-1 text-[10px] font-semibold uppercase tracking-wide",
                m.role === "user" ? "text-slate-300" : "text-violet-600/90",
              )}
            >
              {m.role === "user" ? "Ви" : "Помічник"}
            </p>
            {m.role === "assistant" ? (
              <>
                <AssistantMessageBody text={m.content} variant="light" />
                {m.toolsUsed?.length ? (
                  <AssistantToolBadges
                    toolsUsed={m.toolsUsed}
                    variant="light"
                  />
                ) : null}
                <button
                  type="button"
                  onClick={() => void copyMessage(m.id, m.content)}
                  className="mt-2 inline-flex items-center gap-1 text-[10px] text-slate-400 transition hover:text-violet-600"
                >
                  {copiedId === m.id ? (
                    <>
                      <Check className="h-3 w-3 text-emerald-600" />
                      Скопійовано
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" />
                      Копіювати
                    </>
                  )}
                </button>
              </>
            ) : (
              <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-white/95">
                {m.content}
              </p>
            )}
          </div>
        </div>
      ))}

      {loading ? (
        <div className="flex gap-2.5">
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          </div>
          <div className="flex min-w-0 flex-1 items-center gap-2 rounded-2xl rounded-bl-md border border-violet-100/80 bg-white/90 px-3.5 py-2.5 shadow-sm">
            <div className="flex gap-1">
              <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-violet-400 [animation-delay:-0.3s]" />
              <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-violet-400 [animation-delay:-0.15s]" />
              <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-violet-400" />
            </div>
            <span className="text-[12px] text-slate-500">Думаю над відповіддю…</span>
          </div>
        </div>
      ) : null}

      {error ? (
        <div
          className="rounded-xl border border-rose-200/90 bg-rose-50 px-3 py-2.5 text-[12px] leading-snug text-rose-800 shadow-sm"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      <div ref={bottomRef} className="h-px shrink-0" aria-hidden />
    </div>
  );
}
