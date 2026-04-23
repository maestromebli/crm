"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Bot, Loader2, Send, ShieldCheck, Sparkles } from "lucide-react";
import { useAssistantChat } from "../../features/ai-assistant/hooks/useAssistantChat";
import { cn } from "../../lib/utils";
import { patchJson, postJson } from "../../lib/api/patch-json";

const ADMIN_PROMPTS: string[] = [
  "Зроби аудит CRM: вузькі місця процесу продажу, виробництва, закупівель і комунікацій. Дай топ-10 покращень за ROI.",
  "Побудуй дорожню карту інтеграції AI в CRM на 30/60/90 днів: швидкі перемоги, середні задачі, стратегічні зміни.",
  "Дай список конкретних промптів для менеджерів, РОП, виробництва та закупівель, щоб підвищити конверсію та маржу.",
  "Які автоматизації в ENVER CRM треба увімкнути першими, щоб зменшити втрати лідів і прострочки задач?",
  "Підготуй план метрик AI-контролю: які KPI відстежувати щотижня, щоб бачити реальний ефект від змін.",
];

export function AdminAiAdvisorChat() {
  type TemplateChangeProposal = {
    proposalId: string;
    title: string;
    templateKey: string;
    beforeTemplate: string;
    afterTemplate: string;
    expectedImpact: string;
    rollbackPlan: string;
    createdAt: string;
    createdByUserId: string | null;
    createdByRole: string | null;
    status: "DRAFT" | "APPROVED" | "REJECTED" | "APPLIED";
    statusAt: string;
    statusByUserId: string | null;
    statusByRole: string | null;
    decisionComment: string | null;
  };

  const { data } = useSession();
  const userId = data?.user?.id ?? null;
  const userRole = String(data?.user?.realRole ?? data?.user?.role ?? "").toUpperCase();
  const canApprove = userRole === "SUPER_ADMIN" || userRole === "DIRECTOR" || userRole === "ADMIN";
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
  const [proposalBusy, setProposalBusy] = useState(false);
  const [proposalHint, setProposalHint] = useState<string | null>(null);
  const [proposalDecisionComment, setProposalDecisionComment] = useState<Record<string, string>>({});
  const [proposals, setProposals] = useState<TemplateChangeProposal[]>([]);
  const [proposalsLoading, setProposalsLoading] = useState(false);
  const [proposalForm, setProposalForm] = useState({
    title: "",
    templateKey: "",
    beforeTemplate: "",
    afterTemplate: "",
    expectedImpact: "",
    rollbackPlan: "",
  });

  const loadProposals = useCallback(async () => {
    setProposalsLoading(true);
    try {
      const res = await fetch("/api/settings/ai/template-change/proposals?take=40", {
        method: "GET",
        credentials: "same-origin",
      });
      const data = (await res.json()) as { items?: TemplateChangeProposal[]; error?: string };
      if (!res.ok) {
        throw new Error(data.error || "Не вдалося завантажити пропозиції");
      }
      setProposals(Array.isArray(data.items) ? data.items : []);
    } catch (e) {
      setProposalHint(e instanceof Error ? e.message : "Не вдалося завантажити пропозиції");
    } finally {
      setProposalsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProposals();
  }, [loadProposals]);

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

  const createProposal = async () => {
    if (proposalBusy) return;
    setProposalBusy(true);
    setProposalHint(null);
    try {
      await postJson<{ proposalId: string }>(
        "/api/settings/ai/template-change/proposals",
        {
          title: proposalForm.title.trim(),
          templateKey: proposalForm.templateKey.trim(),
          beforeTemplate: proposalForm.beforeTemplate.trim(),
          afterTemplate: proposalForm.afterTemplate.trim(),
          expectedImpact: proposalForm.expectedImpact.trim(),
          rollbackPlan: proposalForm.rollbackPlan.trim(),
        },
      );
      setProposalForm({
        title: "",
        templateKey: "",
        beforeTemplate: "",
        afterTemplate: "",
        expectedImpact: "",
        rollbackPlan: "",
      });
      setProposalHint("Чернетку зміни шаблону створено. Перед застосуванням потрібне погодження.");
      await loadProposals();
    } catch (e) {
      setProposalHint(
        e instanceof Error ? e.message : "Не вдалося створити пропозицію",
      );
    } finally {
      setProposalBusy(false);
    }
  };

  const decideProposal = async (
    proposalId: string,
    decision: "APPROVED" | "REJECTED",
  ) => {
    if (proposalBusy) return;
    setProposalBusy(true);
    setProposalHint(null);
    try {
      await patchJson<{ status: string }>(
        `/api/settings/ai/template-change/proposals/${proposalId}/decision`,
        {
          decision,
          comment: proposalDecisionComment[proposalId]?.trim() || undefined,
        },
      );
      setProposalHint(
        decision === "APPROVED"
          ? "Пропозицію погоджено."
          : "Пропозицію відхилено.",
      );
      await loadProposals();
    } catch (e) {
      setProposalHint(e instanceof Error ? e.message : "Не вдалося зберегти рішення");
    } finally {
      setProposalBusy(false);
    }
  };

  const applyProposal = async (proposalId: string) => {
    if (proposalBusy) return;
    setProposalBusy(true);
    setProposalHint(null);
    try {
      await postJson<{ status: string }>(
        `/api/settings/ai/template-change/proposals/${proposalId}/apply`,
        {},
      );
      setProposalHint("Зміну шаблону застосовано до системних налаштувань.");
      await loadProposals();
    } catch (e) {
      setProposalHint(
        e instanceof Error ? e.message : "Не вдалося застосувати зміну шаблону",
      );
    } finally {
      setProposalBusy(false);
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

      <div className="mt-3 rounded-xl border border-violet-200 bg-violet-50/70 p-3">
        <p className="text-[11px] font-semibold text-violet-900">
          Процес змін шаблонів (з обов&apos;язковим погодженням)
        </p>
        <p className="mt-0.5 text-[11px] text-violet-900/90">
          Схема: створити чернетку → погодити директором/адміном → застосувати в системі.
        </p>

        <div className="mt-2 grid gap-2 md:grid-cols-2">
          <input
            value={proposalForm.title}
            onChange={(e) =>
              setProposalForm((s) => ({ ...s, title: e.target.value }))
            }
            placeholder="Назва зміни шаблону"
            className="rounded-lg border border-violet-200 bg-white px-3 py-2 text-xs text-slate-900 outline-none focus:border-violet-400"
          />
          <input
            value={proposalForm.templateKey}
            onChange={(e) =>
              setProposalForm((s) => ({ ...s, templateKey: e.target.value }))
            }
            placeholder="Ключ шаблону (напр. manager.followup.v2)"
            className="rounded-lg border border-violet-200 bg-white px-3 py-2 text-xs text-slate-900 outline-none focus:border-violet-400"
          />
          <textarea
            value={proposalForm.beforeTemplate}
            onChange={(e) =>
              setProposalForm((s) => ({ ...s, beforeTemplate: e.target.value }))
            }
            rows={3}
            placeholder="Поточний шаблон (до змін)"
            className="rounded-lg border border-violet-200 bg-white px-3 py-2 text-xs text-slate-900 outline-none focus:border-violet-400"
          />
          <textarea
            value={proposalForm.afterTemplate}
            onChange={(e) =>
              setProposalForm((s) => ({ ...s, afterTemplate: e.target.value }))
            }
            rows={3}
            placeholder="Новий шаблон (після змін)"
            className="rounded-lg border border-violet-200 bg-white px-3 py-2 text-xs text-slate-900 outline-none focus:border-violet-400"
          />
          <textarea
            value={proposalForm.expectedImpact}
            onChange={(e) =>
              setProposalForm((s) => ({ ...s, expectedImpact: e.target.value }))
            }
            rows={2}
            placeholder="Очікуваний вплив (KPI/результат)"
            className="rounded-lg border border-violet-200 bg-white px-3 py-2 text-xs text-slate-900 outline-none focus:border-violet-400"
          />
          <textarea
            value={proposalForm.rollbackPlan}
            onChange={(e) =>
              setProposalForm((s) => ({ ...s, rollbackPlan: e.target.value }))
            }
            rows={2}
            placeholder="План відкату"
            className="rounded-lg border border-violet-200 bg-white px-3 py-2 text-xs text-slate-900 outline-none focus:border-violet-400"
          />
        </div>
        <div className="mt-2 flex items-center gap-2">
          <button
            type="button"
            onClick={() => void createProposal()}
            disabled={
              proposalBusy ||
              !proposalForm.title.trim() ||
              !proposalForm.templateKey.trim() ||
              !proposalForm.afterTemplate.trim() ||
              !proposalForm.expectedImpact.trim() ||
              !proposalForm.rollbackPlan.trim()
            }
            className="rounded-lg bg-violet-700 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-violet-800 disabled:opacity-50"
          >
            {proposalBusy ? "Зберігаю..." : "Створити пропозицію"}
          </button>
          {proposalHint ? (
            <span className="text-[11px] text-violet-900">{proposalHint}</span>
          ) : null}
        </div>

        <div className="mt-3 rounded-lg border border-violet-200 bg-white p-2">
          <p className="text-[11px] font-semibold text-violet-900">
            Черга погодження шаблонів
          </p>
          {proposalsLoading ? (
            <p className="mt-1 text-[11px] text-slate-600">Завантажую...</p>
          ) : proposals.length === 0 ? (
            <p className="mt-1 text-[11px] text-slate-600">
              Немає пропозицій змін шаблонів.
            </p>
          ) : (
            <div className="mt-2 space-y-2">
              {proposals.map((p) => (
                <div
                  key={p.proposalId}
                  className="rounded-lg border border-violet-100 bg-violet-50/50 p-2"
                >
                  <p className="text-[11px] font-semibold text-slate-900">
                    {p.title} · <span className="font-mono">{p.templateKey}</span>
                  </p>
                  <p className="mt-0.5 text-[10px] text-slate-700">
                    Статус: {p.status} · Створено: {new Date(p.createdAt).toLocaleString("uk-UA")}
                  </p>
                  {p.decisionComment ? (
                    <p className="mt-0.5 text-[10px] text-slate-700">
                      Коментар рішення: {p.decisionComment}
                    </p>
                  ) : null}
                  <div className="mt-1 grid gap-1 md:grid-cols-2">
                    <div>
                      <p className="text-[10px] font-semibold text-slate-700">Було</p>
                      <p className="whitespace-pre-wrap text-[10px] text-slate-700">
                        {p.beforeTemplate || "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold text-slate-700">Стане</p>
                      <p className="whitespace-pre-wrap text-[10px] text-slate-700">
                        {p.afterTemplate}
                      </p>
                    </div>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <input
                      value={proposalDecisionComment[p.proposalId] ?? ""}
                      onChange={(e) =>
                        setProposalDecisionComment((prev) => ({
                          ...prev,
                          [p.proposalId]: e.target.value,
                        }))
                      }
                      placeholder="Коментар погодження/відхилення"
                      className="min-w-[220px] flex-1 rounded border border-violet-200 bg-white px-2 py-1 text-[10px] text-slate-900 outline-none focus:border-violet-400"
                    />
                    {canApprove ? (
                      <>
                        <button
                          type="button"
                          onClick={() => void decideProposal(p.proposalId, "APPROVED")}
                          disabled={proposalBusy || p.status === "APPLIED"}
                          className="rounded bg-emerald-700 px-2 py-1 text-[10px] font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
                        >
                          Погодити
                        </button>
                        <button
                          type="button"
                          onClick={() => void decideProposal(p.proposalId, "REJECTED")}
                          disabled={proposalBusy || p.status === "APPLIED"}
                          className="rounded bg-rose-700 px-2 py-1 text-[10px] font-semibold text-white hover:bg-rose-800 disabled:opacity-50"
                        >
                          Відхилити
                        </button>
                        <button
                          type="button"
                          onClick={() => void applyProposal(p.proposalId)}
                          disabled={proposalBusy || p.status !== "APPROVED"}
                          className="rounded bg-indigo-700 px-2 py-1 text-[10px] font-semibold text-white hover:bg-indigo-800 disabled:opacity-50"
                        >
                          Застосувати
                        </button>
                      </>
                    ) : (
                      <span className="text-[10px] text-slate-600">
                        Погодження/застосування доступне лише директору/адміну.
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
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
