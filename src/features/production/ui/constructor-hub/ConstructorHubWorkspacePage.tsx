"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { buildProcurementHubNewRequestHref } from "@/features/procurement/lib/quick-actions";
import { ConstructorActionBar } from "./components/ConstructorActionBar";
import { ConstructorAIInsights } from "./components/ConstructorAIInsights";
import { ConstructorApprovalPanel } from "./components/ConstructorApprovalPanel";
import { ConstructorApprovedSummary } from "./components/ConstructorApprovedSummary";
import { ConstructorContactsCard } from "./components/ConstructorContactsCard";
import { ConstructorFilesBoard } from "./components/ConstructorFilesBoard";
import { ConstructorHubHeader } from "./components/ConstructorHubHeader";
import { ConstructorLeftPanel } from "./components/ConstructorLeftPanel";
import { ConstructorQuestionsPanel } from "./components/ConstructorQuestionsPanel";
import { ConstructorTechSpec } from "./components/ConstructorTechSpec";
import { ConstructorTimeline } from "./components/ConstructorTimeline";
import { ConstructorVersionsPanel } from "./components/ConstructorVersionsPanel";
import type { ConstructorWorkspace } from "./constructor-hub.types";

const tabs = [
  { id: "TECH", label: "ТЗ" },
  { id: "FILES", label: "Файли" },
  { id: "QUESTIONS", label: "Питання" },
  { id: "CHAT", label: "Чат" },
  { id: "VERSIONS", label: "Версії" },
  { id: "CHECK", label: "Перевірка" },
  { id: "HISTORY", label: "Історія" },
] as const;

type TabId = (typeof tabs)[number]["id"];

export function ConstructorHubWorkspacePage({ workspace }: { workspace: ConstructorWorkspace }) {
  const [activeTab, setActiveTab] = useState<TabId>("TECH");
  const [messages, setMessages] = useState(workspace.communication);
  const [flash, setFlash] = useState<string | null>(null);
  const canCreateProcurementRequest =
    workspace.header.status === "APPROVED" || workspace.header.status === "HANDED_OFF";

  const criticalOpenQuestions = useMemo(
    () => workspace.questions.filter((question) => question.priority === "CRITICAL" && question.status !== "CLOSED").length,
    [workspace.questions],
  );

  const fire = (text: string) => {
    setFlash(text);
    window.setTimeout(() => setFlash(null), 2400);
  };

  return (
    <main className="mx-auto max-w-[1680px] space-y-4 p-3 md:p-5">
      <ConstructorHubHeader header={workspace.header} />
      <ConstructorActionBar
        onNextStep={() => fire("Перехід до наступного етапу підготовлено.")}
        onAskQuestion={() => setActiveTab("QUESTIONS")}
        onUploadFiles={() => setActiveTab("FILES")}
        onSubmitForReview={() => setActiveTab("CHECK")}
        onSaveDraft={() => fire("Чернетку збережено локально (тимчасовий callback).")}
      />

      {flash ? (
        <div className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900">{flash}</div>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)_330px]">
        <ConstructorLeftPanel
          stages={workspace.stages}
          checklist={workspace.checklist}
          zoneProgress={workspace.zoneProgress}
          tasks={workspace.tasks}
        />

        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white p-1 shadow-sm">
            <div className="flex flex-wrap gap-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`rounded-xl px-3 py-1.5 text-sm font-medium transition ${
                  activeTab === tab.id ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {tab.label}
              </button>
            ))}
            </div>
            <Link
              href={`/deals/${workspace.header.dealId}/workspace?tab=production`}
              className="rounded-xl border border-slate-200 bg-[var(--enver-card)] px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-[var(--enver-hover)]"
            >
              Робоча зона в замовленні
            </Link>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-3 text-xs text-emerald-900">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium">Передача в закупівлі з конструктора</p>
              {canCreateProcurementRequest ? (
                <Link
                  href={buildProcurementHubNewRequestHref(
                    workspace.header.dealId,
                    "constructor_workspace",
                  )}
                  className="rounded-lg border border-emerald-300 bg-white px-2.5 py-1 font-semibold text-emerald-900 hover:bg-emerald-100"
                >
                  Створити заявку закупівлі
                </Link>
              ) : (
                <span className="rounded bg-amber-100 px-2 py-0.5 font-medium text-amber-900">
                  Очікується погодження
                </span>
              )}
            </div>
            <p className="mt-1 text-[11px] text-emerald-900/90">
              Заявка створюється тільки після погодження начальником виробництва або головним конструктором.
            </p>
          </div>

          {activeTab === "TECH" ? (
            <>
              <ConstructorTechSpec sections={workspace.techSections} zones={workspace.zoneProgress} />
              <ConstructorQuestionsPanel questions={workspace.questions} />
            </>
          ) : null}
          {activeTab === "FILES" ? <ConstructorFilesBoard files={workspace.files} /> : null}
          {activeTab === "QUESTIONS" ? <ConstructorQuestionsPanel questions={workspace.questions} /> : null}
          {activeTab === "CHAT" ? (
            <ConstructorContactsCard
              contacts={workspace.contacts}
              messages={messages}
              onSendMessage={(text) => {
                setMessages((prev) => [
                  {
                    id: `local-${Date.now()}`,
                    authorName: "Ви",
                    authorRole: "Конструктор",
                    text,
                    createdAt: new Date().toISOString(),
                  },
                  ...prev,
                ]);
              }}
            />
          ) : null}
          {activeTab === "VERSIONS" ? <ConstructorVersionsPanel versions={workspace.versions} /> : null}
          {activeTab === "CHECK" ? (
            <ConstructorApprovalPanel
              reviews={workspace.approvalReviews}
              onApprove={() => fire("Версію позначено як прийняту (тимчасовий callback).")}
              onReturn={(payload) => fire(`Повернення на доопрацювання: ${payload.severity}`)}
            />
          ) : null}
          {activeTab === "HISTORY" ? <ConstructorTimeline events={workspace.timeline} /> : null}
        </div>

        <aside className="space-y-3 xl:sticky xl:top-4 xl:h-fit">
          <ConstructorApprovedSummary data={workspace.approvedSummary} />
          <ConstructorAIInsights alerts={workspace.aiAlerts} onRunCheck={() => fire("AI-проверка запущена (mock).")} />
          <ConstructorContactsCard
            contacts={workspace.contacts}
            messages={messages}
            onSendMessage={(text) => {
              setMessages((prev) => [
                {
                  id: `ctx-${Date.now()}`,
                  authorName: "Ви",
                  authorRole: "Конструктор",
                  text,
                  createdAt: new Date().toISOString(),
                },
                ...prev,
              ]);
            }}
          />
          {criticalOpenQuestions > 0 ? (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-900">
              Критичних питань без відповіді: {criticalOpenQuestions}
            </div>
          ) : null}
        </aside>
      </section>
    </main>
  );
}
