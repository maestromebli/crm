"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import Image from "next/image";
import { useAssistantChat } from "../../features/ai-assistant/hooks/useAssistantChat";

type RobotEmotion =
  | "happy"
  | "thinking"
  | "loading"
  | "surprised"
  | "wink"
  | "sad";

const EMOTION_TEXTURES: Record<RobotEmotion, string> = {
  happy: "/robot-assistant/emotions/happy.png",
  thinking: "/robot-assistant/emotions/thinking.png",
  loading: "/robot-assistant/emotions/loading.png",
  surprised: "/robot-assistant/emotions/surprised.png",
  wink: "/robot-assistant/emotions/wink.png",
  sad: "/robot-assistant/emotions/sad.png",
};

type ChatMessage = {
  id: string;
  role: "assistant" | "user";
  text: string;
};

export function NewAssistantWidget() {
  const { data: session } = useSession();
  const [isOpen, setIsOpen] = useState(false);
  const [reactionEmotion, setReactionEmotion] = useState<RobotEmotion>("wink");
  const [input, setInput] = useState("");
  const { messages, loading, error, send, clearMessages } = useAssistantChat({
    persistUserId: session?.user?.id ?? null,
    endpoint: "/api/ai/chat",
    storagePrefix: "enver_new_assistant_chat_v1",
  });
  const emotionTimeoutRef = useRef<number | null>(null);

  const triggerEmotion = useCallback((
    next: RobotEmotion,
    durationMs = 1200,
    fallback: RobotEmotion = "happy",
  ) => {
    if (emotionTimeoutRef.current) {
      window.clearTimeout(emotionTimeoutRef.current);
      emotionTimeoutRef.current = null;
    }
    setReactionEmotion(next);
    if (durationMs > 0) {
      emotionTimeoutRef.current = window.setTimeout(() => {
        setReactionEmotion(fallback);
        emotionTimeoutRef.current = null;
      }, durationMs);
    }
  }, []);

  useEffect(() => {
    const onEmotion = (event: Event) => {
      const customEvent = event as CustomEvent<{
        emotion?: RobotEmotion;
        important?: boolean;
      }>;
      const nextEmotion = customEvent.detail?.emotion;
      if (!nextEmotion || !(nextEmotion in EMOTION_TEXTURES)) return;
      if (nextEmotion === "surprised" && !customEvent.detail?.important) return;
      triggerEmotion(nextEmotion, 1400, "happy");
    };

    const onImportantUpdate = () => {
      triggerEmotion("surprised", 1800, "happy");
    };

    window.addEventListener("enver-assistant-emotion", onEmotion as EventListener);
    window.addEventListener(
      "enver-crm-important-update",
      onImportantUpdate as EventListener,
    );
    return () => {
      if (emotionTimeoutRef.current) {
        window.clearTimeout(emotionTimeoutRef.current);
        emotionTimeoutRef.current = null;
      }
      window.removeEventListener(
        "enver-assistant-emotion",
        onEmotion as EventListener,
      );
      window.removeEventListener(
        "enver-crm-important-update",
        onImportantUpdate as EventListener,
      );
    };
  }, [triggerEmotion]);

  useEffect(() => {
    if (!loading) return;

    const longThinkingTimer = window.setTimeout(() => {
      triggerEmotion("thinking", 0);
    }, 3200);

    const extendedWaitTimer = window.setTimeout(() => {
      triggerEmotion("surprised", 1400, "loading");
    }, 9000);

    return () => {
      window.clearTimeout(longThinkingTimer);
      window.clearTimeout(extendedWaitTimer);
    };
  }, [loading, triggerEmotion]);

  useEffect(() => {
    const idleTimer = window.setInterval(() => {
      if (loading || error || input.trim().length > 0) return;
      triggerEmotion("wink", 900, "happy");
    }, 22000);
    return () => {
      window.clearInterval(idleTimer);
    };
  }, [error, input, loading, triggerEmotion]);

  const sendMessage = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    setInput("");
    triggerEmotion("thinking", 700, "loading");

    void send(trimmed, () => {
      triggerEmotion("happy", 1600, "wink");
    });
  };

  const emotion: RobotEmotion = loading
    ? "loading"
    : error
      ? "sad"
      : reactionEmotion;

  const chatMessages: ChatMessage[] =
    messages.length > 0
      ? messages.map((message) => ({
          id: message.id,
          role: message.role,
          text: message.content,
        }))
      : [
          {
            id: "default-greeting",
            role: "assistant",
            text: "Привіт! Я динамічний помічник ENVER. Поставте запитання щодо лідів, замовлень або задач.",
          },
        ];

  const isReplying = loading;

  const quickActionPrompt = (prompt: string) => {
    sendMessage(prompt);
  };

  return (
    <div className="pointer-events-none fixed bottom-0 right-0 z-[180] p-3">
      <div className="pointer-events-auto flex flex-col items-end gap-1.5">
        {isOpen ? (
          <div className="w-[min(95vw,390px)] overflow-hidden rounded-2xl border border-slate-300 bg-slate-50 shadow-xl shadow-slate-400/35">
            <div className="flex items-center justify-between border-b border-slate-700 bg-slate-900 px-3 py-2 text-slate-100">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-100">
                  ENVER Помічник PRO
                </p>
                <p className="text-[11px] text-slate-300">
                  CRM-помічник
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                  онлайн
                </span>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="rounded-lg border border-slate-500 px-2 py-0.5 text-xs text-slate-100 transition hover:bg-slate-800"
                  aria-label="Згорнути асистента"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="border-b border-slate-300 bg-slate-100 px-2.5 py-2">
              <div className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700">
                Статус помічника: <span className="font-medium">{emotion}</span>
              </div>
            </div>

            <div className="space-y-1.5 bg-slate-100 p-2">
              <div className="max-h-[150px] space-y-1.5 overflow-y-auto rounded-xl border border-slate-300 bg-white p-1.5">
                {chatMessages.map((message) => (
                  <div
                    key={message.id}
                    className={`max-w-[92%] rounded-xl px-2.5 py-1.5 text-xs ${
                      message.role === "assistant"
                        ? "bg-white text-slate-700 shadow-sm"
                        : "ml-auto bg-sky-600 text-white"
                    }`}
                  >
                    {message.text}
                  </div>
                ))}
                {isReplying ? (
                  <div className="max-w-[90%] rounded-2xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-600">
                    Думаю над відповіддю...
                  </div>
                ) : null}
                {error ? (
                  <div className="max-w-[95%] rounded-2xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs text-rose-700">
                    {error}
                  </div>
                ) : null}
              </div>

              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    triggerEmotion("wink", 1200, "thinking");
                    quickActionPrompt("Покажи нові ліди за сьогодні");
                  }}
                  className="rounded-full border border-slate-300 bg-white px-2 py-1 text-[10px] text-slate-700 hover:bg-slate-50"
                >
                  Нові ліди
                </button>
                <button
                  type="button"
                  onClick={() => {
                    triggerEmotion("thinking", 1000, "loading");
                    quickActionPrompt("Які замовлення зараз без наступного кроку?");
                  }}
                  className="rounded-full border border-slate-300 bg-white px-2 py-1 text-[10px] text-slate-700 hover:bg-slate-50"
                >
                  Замовлення без кроку
                </button>
                <button
                  type="button"
                  onClick={() => {
                    triggerEmotion("thinking", 1200, "loading");
                    quickActionPrompt("Розбери помилку в CRM і запропонуй кроки");
                  }}
                  className="rounded-full border border-slate-300 bg-white px-2 py-1 text-[10px] text-slate-700 hover:bg-slate-50"
                >
                  Розбір помилки
                </button>
                <button
                  type="button"
                  onClick={() => {
                    clearMessages();
                    triggerEmotion("wink", 1300, "happy");
                  }}
                  className="rounded-full border border-slate-300 bg-white px-2 py-1 text-[10px] text-slate-700 hover:bg-slate-50"
                >
                  Очистити чат
                </button>
              </div>

              <form
                className="flex items-center gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  sendMessage(input);
                }}
              >
                <input
                  value={input}
                  onFocus={() => triggerEmotion("thinking", 1200, "happy")}
                  onChange={(event) => {
                    setInput(event.target.value);
                    triggerEmotion("thinking", 800, "happy");
                  }}
                  placeholder="Напишіть запит асистенту..."
                  className="h-8.5 flex-1 rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none placeholder:text-slate-500 focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                />
                <button
                  type="submit"
                  disabled={!input.trim() || isReplying}
                  className="h-8.5 rounded-xl bg-slate-900 px-3 text-xs font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Надіслати
                </button>
              </form>
            </div>
          </div>
        ) : null}

        <button
          type="button"
          onClick={() => setIsOpen((value) => !value)}
          className="relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border border-slate-300 bg-white shadow-md shadow-slate-300/40 transition hover:border-sky-400/70"
          aria-label={isOpen ? "Згорнути асистента" : "Відкрити асистента"}
        >
          <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.22),transparent_60%)]" />
          <Image
            src={EMOTION_TEXTURES[emotion]}
            alt="Обличчя асистента"
            width={34}
            height={34}
            className="relative h-8.5 w-8.5 rounded-full object-cover"
          />
          {isReplying ? (
            <span className="absolute -right-0.5 -top-0.5 h-3.5 w-3.5 rounded-full border border-white bg-sky-500" />
          ) : null}
        </button>
      </div>
    </div>
  );
}
