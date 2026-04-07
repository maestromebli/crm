"use client";

import { useEffect, useState } from "react";
import { postJson } from "@/lib/api/patch-json";
import type { InboxConversation } from "../types";

type Props = {
  conversation: InboxConversation;
};

export function InboxAiSummary({ conversation }: Props) {
  const [text, setText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const context = `Канал: ${conversation.channel}. Клієнт: ${
      conversation.customerName
    } (${conversation.customerHandle ?? "немає хендлу"}).
SLA: ${conversation.slaState}. Останнє повідомлення: ${
      conversation.messages[conversation.messages.length - 1]?.text ??
      "немає повідомлень"
    }.`;

    const run = async () => {
      try {
        setLoading(true);
        const data = await postJson<{ text?: string }>("/api/ai/summary", {
          type: "inbox_conversation",
          context,
        });
        if (data.text) setText(data.text);
      } catch {
        setText(
          "Не вдалося отримати AI‑summary. Перевірте налаштування AI.",
        );
      } finally {
        setLoading(false);
      }
    };

    void run();
  }, [conversation]);

  if (loading && !text) {
    return (
      <p className="text-xs text-slate-600">
        AI аналізує діалог…
      </p>
    );
  }

  return (
    <p className="text-xs text-slate-600">
      {text ??
        "AI ще не надіслав огляд. Перевірте підключення AI."}
    </p>
  );
}

