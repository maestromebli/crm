"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { parseJsonResponse } from "../../../lib/http/parse-json-response";

export type AssistantChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolsUsed?: string[];
};

/** Відповідає ліміту тіла в /api/ai/chat і розумному обсягу для моделі */
const MAX_MESSAGES = 40;

type UseAssistantChatOptions = {
  /** Якщо задано — історія діалогу зберігається в sessionStorage на сесію браузера */
  persistUserId?: string | null;
};

export function useAssistantChat(options?: UseAssistantChatOptions) {
  const persistUserId = options?.persistUserId ?? null;
  const storageKey = useMemo(
    () =>
      persistUserId ? `enver_assistant_chat_v1_${persistUserId}` : null,
    [persistUserId],
  );

  const [messages, setMessages] = useState<AssistantChatMessage[]>([]);
  /** Після завантаження з sessionStorage для поточного storageKey — дозволяє збереження */
  const storageReadyRef = useRef(false);

  useLayoutEffect(() => {
    storageReadyRef.current = false;
    if (typeof window === "undefined") return;

    if (!storageKey) {
      setMessages([]);
      storageReadyRef.current = true;
      return;
    }

    try {
      const raw = sessionStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as {
          messages?: AssistantChatMessage[];
        };
        if (Array.isArray(parsed.messages) && parsed.messages.length > 0) {
          setMessages(parsed.messages.slice(-MAX_MESSAGES));
        } else {
          setMessages([]);
        }
      } else {
        setMessages([]);
      }
    } catch {
      setMessages([]);
    }
    storageReadyRef.current = true;
  }, [storageKey]);

  useEffect(() => {
    if (!storageKey || typeof window === "undefined") return;
    if (!storageReadyRef.current) return;
    try {
      sessionStorage.setItem(
        storageKey,
        JSON.stringify({ messages: messages.slice(-MAX_MESSAGES) }),
      );
    } catch {
      /* quota / private mode */
    }
  }, [messages, storageKey]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(null);
    if (storageKey && typeof window !== "undefined") {
      try {
        sessionStorage.removeItem(storageKey);
      } catch {
        /* ignore */
      }
    }
  }, [storageKey]);

  const send = useCallback(
    async (raw: string, onComplete?: () => void) => {
      const trimmed = raw.trim();
      if (!trimmed || loading) return;

      const userMsg: AssistantChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: trimmed,
      };
      const history = [...messages, userMsg].slice(-MAX_MESSAGES);
      setMessages(history);
      setError(null);
      setLoading(true);

      try {
        const res = await fetch("/api/ai/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: history.map((m) => ({
              role: m.role,
              content: m.content,
            })),
          }),
        });
        const data = await parseJsonResponse<{
          text?: string;
          error?: string;
          toolsUsed?: string[];
        }>(res);
        if (!res.ok) {
          setError(data.error ?? "Помилка запиту");
          return;
        }
        const reply = data.text?.trim() ?? "Порожня відповідь від сервера.";
        const assistantMsg: AssistantChatMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: reply,
          toolsUsed:
            data.toolsUsed && data.toolsUsed.length > 0
              ? data.toolsUsed
              : undefined,
        };
        setMessages((prev) => [...prev, assistantMsg].slice(-MAX_MESSAGES));
      } catch (e) {
        setError(
          e instanceof Error ? e.message : "Не вдалося з’єднатися з сервером",
        );
      } finally {
        setLoading(false);
        onComplete?.();
      }
    },
    [loading, messages],
  );

  return {
    messages,
    loading,
    error,
    send,
    clearMessages,
    setError,
  };
}
