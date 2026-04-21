"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Bot,
  Copy,
  Check,
  Loader2,
  Send,
  Sparkles,
  User,
  Wand2,
} from "lucide-react";
import {
  AssistantMessageBody,
  AssistantToolBadges,
} from "../../features/ai-assistant/components/AssistantMessageBody";
import { useAssistantChat } from "../../features/ai-assistant/hooks/useAssistantChat";
import { cn } from "../../lib/utils";

const SUGGESTIONS: { text: string; label: string }[] = [
  {
    label: "Огляд",
    text: "Скільки у мене зараз лідів, замовлень і відкритих задач?",
  },
  {
    label: "Навігація",
    text: "Де в меню знайти передачу в виробництво та чергу робіт?",
  },
  {
    label: "Календар",
    text: "Які найближчі події в календарі на цьому тижні?",
  },
  {
    label: "Замовлення",
    text: "Як змінити етап замовлення та відкрити робоче місце проєкту?",
  },
];

export function AiAssistantChat() {
  const { messages, loading, error, send, clearMessages } = useAssistantChat();
  const [input, setInput] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading, scrollToBottom]);

  const copyMessage = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      window.setTimeout(() => setCopiedId(null), 2000);
    } catch {
      /* ignore */
    }
  };

  const clearChat = () => {
    clearMessages();
  };

  return (
    <div className="mt-8 w-full max-w-3xl">
      <div
        className={cn(
          "relative overflow-hidden rounded-3xl border border-white/60",
          "bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900",
          "shadow-[0_24px_80px_-12px_rgba(79,70,229,0.35),0_0_0_1px_rgba(255,255,255,0.06)_inset]",
        )}
      >
        <div
          className="pointer-events-none absolute -left-24 -top-24 h-64 w-64 rounded-full bg-violet-500/25 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-16 -right-16 h-56 w-56 rounded-full bg-sky-500/20 blur-3xl"
          aria-hidden
        />

        <div className="relative px-5 pb-5 pt-6 sm:px-7 sm:pb-7 sm:pt-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div
                className={cn(
                  "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl",
                  "bg-gradient-to-br from-violet-500 to-indigo-600 shadow-lg shadow-violet-500/30",
                )}
              >
                <Wand2 className="h-6 w-6 text-white" strokeWidth={1.75} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold tracking-tight text-white">
                    Помічник ENVER
                  </h2>
                  <span className="inline-flex items-center gap-1 rounded-full bg-[var(--enver-card)]/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-violet-200/90">
                    <Sparkles className="h-3 w-3" />
                    AI + CRM
                  </span>
                </div>
                <p className="mt-1 max-w-xl text-sm leading-snug text-slate-300/90">
                  Відповіді з урахуванням ваших прав. Дані підтягуються з бази
                  лише через захищені інструменти — без зайвого шуму.
                </p>
              </div>
            </div>
            {messages.length > 0 ? (
              <button
                type="button"
                onClick={clearChat}
                className="rounded-xl border border-white/10 bg-[var(--enver-card)]/5 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:bg-[var(--enver-card)]/10"
              >
                Очистити чат
              </button>
            ) : null}
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s.label}
                type="button"
                disabled={loading}
                onClick={() => void send(s.text)}
                className={cn(
                  "rounded-full border border-white/10 bg-[var(--enver-card)]/5 px-3 py-1.5 text-left text-xs font-medium text-slate-100",
                  "transition hover:border-violet-400/40 hover:bg-violet-500/15 hover:text-white",
                  "disabled:cursor-not-allowed disabled:opacity-40",
                )}
              >
                <span className="text-violet-300/90">{s.label}:</span>{" "}
                <span className="text-slate-200/95">{s.text}</span>
              </button>
            ))}
          </div>

          <div
            ref={scrollRef}
            className={cn(
              "mt-6 max-h-[min(420px,55vh)] space-y-4 overflow-y-auto rounded-2xl",
              "border border-white/10 bg-black/20 p-4 backdrop-blur-sm",
            )}
          >
            {messages.length === 0 && !loading ? (
              <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
                <div className="rounded-2xl border border-dashed border-white/15 bg-[var(--enver-card)]/5 px-6 py-8">
                  <Bot className="mx-auto h-10 w-10 text-violet-300/80" />
                  <p className="mt-3 text-sm font-medium text-slate-200">
                    Запитайте про ліди, замовлення, задачі чи де знайти розділ у меню
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    Або оберіть швидку підказку вище
                  </p>
                </div>
              </div>
            ) : null}

            {messages.map((m) => (
              <div
                key={m.id}
                className={cn(
                  "flex gap-3",
                  m.role === "user" ? "flex-row-reverse" : "flex-row",
                )}
              >
                <div
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                    m.role === "user"
                      ? "bg-sky-500/25 text-sky-200"
                      : "bg-violet-500/25 text-violet-200",
                  )}
                >
                  {m.role === "user" ? (
                    <User className="h-4 w-4" />
                  ) : (
                    <Bot className="h-4 w-4" />
                  )}
                </div>
                <div
                  className={cn(
                    "min-w-0 max-w-[min(100%,520px)] rounded-2xl px-4 py-3",
                    m.role === "user"
                      ? "bg-sky-500/20 text-slate-50"
                      : "border border-white/10 bg-[var(--enver-card)]/[0.07] text-slate-100",
                  )}
                >
                  {m.role === "assistant" ? (
                    <AssistantMessageBody text={m.content} variant="dark" />
                  ) : (
                    <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-slate-50">
                      {m.content}
                    </p>
                  )}

                  {m.role === "assistant" && m.toolsUsed?.length ? (
                    <AssistantToolBadges
                      toolsUsed={m.toolsUsed}
                      variant="dark"
                    />
                  ) : null}

                  {m.role === "assistant" ? (
                    <button
                      type="button"
                      onClick={() => void copyMessage(m.id, m.content)}
                      className="mt-2 inline-flex items-center gap-1 text-[11px] text-slate-400 transition hover:text-slate-200"
                    >
                      {copiedId === m.id ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-emerald-400" />
                          Скопійовано
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" />
                          Копіювати
                        </>
                      )}
                    </button>
                  ) : null}
                </div>
              </div>
            ))}

            {loading ? (
              <div className="flex gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-500/25">
                  <Loader2 className="h-4 w-4 animate-spin text-violet-200" />
                </div>
                <div className="flex flex-1 items-center gap-3 rounded-2xl border border-white/10 bg-[var(--enver-card)]/5 px-4 py-3">
                  <div className="flex gap-1">
                    <span className="inline-block h-2 w-2 animate-bounce rounded-full bg-violet-400 [animation-delay:-0.3s]" />
                    <span className="inline-block h-2 w-2 animate-bounce rounded-full bg-violet-400 [animation-delay:-0.15s]" />
                    <span className="inline-block h-2 w-2 animate-bounce rounded-full bg-violet-400" />
                  </div>
                  <span className="text-xs text-slate-400">
                    Запит до AI та CRM…
                  </span>
                </div>
              </div>
            ) : null}
          </div>

          {error ? (
            <div className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
              {error}
            </div>
          ) : null}

          <div className="mt-4 flex gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send(input, () => setInput(""));
                }
              }}
              placeholder="Питання про CRM, ліди, замовлення, навігацію…"
              rows={2}
              disabled={loading}
              className={cn(
                "min-h-[52px] flex-1 resize-none rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white placeholder:text-slate-500",
                "outline-none ring-2 ring-transparent transition placeholder:opacity-80",
                "focus:border-violet-400/40 focus:ring-violet-500/25",
                "disabled:opacity-50",
              )}
            />
            <button
              type="button"
              onClick={() => void send(input, () => setInput(""))}
              disabled={loading || !input.trim()}
              className={cn(
                "group flex shrink-0 items-center justify-center gap-2 self-end rounded-2xl px-5 py-3 text-sm font-semibold",
                "bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-lg shadow-violet-500/25",
                "transition hover:brightness-110 hover:shadow-violet-500/40",
                "disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none",
              )}
            >
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Send className="h-5 w-5 transition group-active:translate-x-0.5" />
              )}
              <span className="hidden sm:inline">
                {loading ? "Чекаю…" : "Надіслати"}
              </span>
            </button>
          </div>
          <p className="mt-2 text-center text-[10px] text-slate-500">
            Enter — надіслати · Shift+Enter — новий рядок
          </p>
        </div>
      </div>
    </div>
  );
}
