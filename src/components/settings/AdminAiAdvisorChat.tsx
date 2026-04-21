"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { Bot, Loader2, Send, ShieldCheck, Sparkles } from "lucide-react";
import { useAssistantChat } from "../../features/ai-assistant/hooks/useAssistantChat";
import { cn } from "../../lib/utils";
import { postJson } from "../../lib/api/patch-json";

const ADMIN_PROMPTS: string[] = [
  "Зроби аудит CRM: вузькі місця процесу продажу, виробництва, закупівель і комунікацій. Дай топ-10 покращень за ROI.",
  "Побудуй дорожню карту інтеграції AI в CRM на 30/60/90 днів: швидкі перемоги, середні задачі, стратегічні зміни.",
  "Дай список конкретних промптів для менеджерів, РОП, виробництва та закупівель, щоб підвищити конверсію та маржу.",
  "Які автоматизації в ENVER CRM треба увімкнути першими, щоб зменшити втрати лідів і прострочки задач?",
  "Підготуй план метрик AI-контролю: які KPI відстежувати щотижня, щоб бачити реальний ефект від змін.",
];

export function AdminAiAdvisorChat() {
  const { data } = useSession();
  const userId = data?.user?.id ?? null;
  const {
    messages,
    loading,
    error,
    send,
    clearMessages,
  } = useAssistantChat({
    persistUserId: userId,
    endpoint: "/api/settings/ai/admin-chat",
    storagePrefix: "enver_admin_ai_chat_v1",
  });
  const [input, setInput] = useState("");
  const [knowledgeNote, setKnowledgeNote] = useState("");
  const [knowledgeBusy, setKnowledgeBusy] = useState(false);
  const [knowledgeHint, setKnowledgeHint] = useState<string | null>(null);

  const saveKnowledge = async () => {
    const note = knowledgeNote.trim();
    if (!note || knowledgeBusy) return;
    setKnowledgeBusy(true);
    setKnowledgeHint(null);
    try {
      await postJson<{ ok?: boolean; error?: string }>(
        "/api/settings/ai/admin-knowledge",
        { note },
      );
      setKnowledgeNote("");
      setKnowledgeHint("Знання збережено. AI буде враховувати це в наступних відповідях.");
    } catch (e) {
      setKnowledgeHint(
        e instanceof Error ? e.message : "Не вдалося зберегти знання",
      );
    } finally {
      setKnowledgeBusy(false);
    }
  };

  return (
    <section className="rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50 via-white to-violet-50 p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white">
            <Bot className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-semibold text-indigo-950">
              AI-архітектор CRM (адмін-чат)
            </p>
            <p className="mt-0.5 text-xs text-indigo-900/80">
              Консультант з покращення системи: процеси, автоматизації, промпти, ризики та план розвитку.
            </p>
          </div>
        </div>
        {messages.length > 0 ? (
          <button
            type="button"
            onClick={clearMessages}
            className="rounded-lg border border-indigo-200 bg-white px-2.5 py-1 text-[11px] font-medium text-indigo-900 hover:bg-indigo-50"
          >
            Очистити діалог
          </button>
        ) : null}
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {ADMIN_PROMPTS.map((prompt) => (
          <button
            key={prompt}
            type="button"
            disabled={loading}
            onClick={() => void send(prompt)}
            className="rounded-full border border-indigo-200 bg-white px-2.5 py-1 text-[11px] text-indigo-900 hover:bg-indigo-50 disabled:opacity-60"
          >
            <Sparkles className="mr-1 inline h-3 w-3" />
            Готовий запит
          </button>
        ))}
      </div>

      <div className="mt-3 max-h-[420px] space-y-2 overflow-y-auto rounded-xl border border-indigo-100 bg-white p-3">
        {messages.length === 0 ? (
          <p className="text-xs text-slate-600">
            Поставте задачу AI як системному раднику. Він поверне конкретні кроки покращення, пріоритети та приклади промптів для команди.
          </p>
        ) : null}

        {messages.map((m) => (
          <div
            key={m.id}
            className={cn(
              "rounded-lg px-3 py-2 text-xs",
              m.role === "user"
                ? "ml-6 bg-indigo-600 text-white"
                : "mr-6 border border-indigo-100 bg-indigo-50/50 text-slate-800",
            )}
          >
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide opacity-80">
              {m.role === "user" ? "Ви" : "AI-радник"}
            </p>
            <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
          </div>
        ))}

        {loading ? (
          <div className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-100 bg-indigo-50 px-2.5 py-1 text-[11px] text-indigo-900">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            AI аналізує CRM…
          </div>
        ) : null}
      </div>

      {error ? (
        <p className="mt-2 text-xs text-rose-600">{error}</p>
      ) : null}

      <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50/70 p-3">
        <p className="text-[11px] font-semibold text-emerald-900">
          Скармити AI знання для подальшого навчання
        </p>
        <p className="mt-0.5 text-[11px] text-emerald-800/90">
          Додайте інструкції, контекст компанії, правила продажу, стандарти роботи або майбутні цілі CRM.
        </p>
        <textarea
          value={knowledgeNote}
          onChange={(e) => setKnowledgeNote(e.target.value)}
          rows={4}
          disabled={knowledgeBusy}
          placeholder="Напр.: Наш стандарт відповіді ліду — до 15 хв у робочий час; усі замовлення > 200 000 грн проходять контроль маржі перед КП."
          className="mt-2 w-full rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs text-slate-900 outline-none focus:border-emerald-400"
        />
        <div className="mt-2 flex items-center gap-2">
          <button
            type="button"
            onClick={() => void saveKnowledge()}
            disabled={knowledgeBusy || !knowledgeNote.trim()}
            className="rounded-lg bg-emerald-700 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
          >
            {knowledgeBusy ? "Зберігаю..." : "Зберегти в навчання AI"}
          </button>
          {knowledgeHint ? (
            <span className="text-[11px] text-emerald-900">{knowledgeHint}</span>
          ) : null}
        </div>
      </div>

      <div className="mt-3 flex gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send(input, () => setInput(""));
            }
          }}
          rows={3}
          disabled={loading}
          placeholder="Напр.: Які 5 змін у CRM найшвидше піднімуть конверсію і маржу? Дай план впровадження."
          className="w-full rounded-xl border border-indigo-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-400"
        />
        <button
          type="button"
          onClick={() => void send(input, () => setInput(""))}
          disabled={loading || !input.trim()}
          className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-indigo-700 px-3 text-xs font-semibold text-white hover:bg-indigo-800 disabled:opacity-50"
        >
          <Send className="h-3.5 w-3.5" />
          Надіслати
        </button>
      </div>

      <p className="mt-2 inline-flex items-center gap-1 text-[10px] text-slate-500">
        <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
        Доступ лише для адміністраторів з правом керування налаштуваннями.
      </p>
    </section>
  );
}
