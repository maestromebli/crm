"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ProductionOrderHubView } from "../../types/production";

export function ProductionOrderHubPage({ data }: { data: ProductionOrderHubView }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [constructorName, setConstructorName] = useState(data.flow.constructorName ?? "");
  const [dueDate, setDueDate] = useState(data.flow.dueDate ? data.flow.dueDate.slice(0, 10) : "");
  const [questionText, setQuestionText] = useState("");
  const [packageName, setPackageName] = useState("");
  const [packageVersion, setPackageVersion] = useState("v1");
  const [rejectionReason, setRejectionReason] = useState("");

  async function post(path: string, body?: unknown) {
    setError(null);
    setBusy(true);
    try {
      const response = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Помилка запиту.");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Помилка запиту.");
    } finally {
      setBusy(false);
    }
  }

  const flowId = data.flow.id;
  const currentStep = data.flow.currentStepKey;
  const blockers = data.blockers;
  const hasBlockers = blockers.length > 0;
  const openQuestions = data.questions.filter((question) => question.status === "OPEN").length;
  const pressureText =
    openQuestions > 0
      ? `⚠ Є відкриті питання (${openQuestions}). Закрийте перед апрувом.`
      : hasBlockers
        ? "⚠ Є активні блокери. Наступний крок заблоковано."
        : null;

  return (
    <div className="space-y-5">
      <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">
          {data.flow.number} · {data.flow.title}
        </h1>
        <p className="mt-1 text-sm text-slate-600">Клієнт: {data.flow.clientName}</p>
      </header>

      <section className="grid gap-4 xl:grid-cols-[300px_1fr_320px]">
        <aside className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm font-semibold">Поточний крок</p>
          <p className="text-xs text-slate-600">{currentStep}</p>
          <p className="text-xs">Готовність: {data.flow.readinessPercent}%</p>
          <p className="text-xs">Ризик: {data.flow.riskScore}/100</p>
          <div className="space-y-2 pt-2">
            {data.steps.map((step) => (
              <div key={step.key} className="text-xs">
                <p className="font-medium">{step.label}</p>
                <p className="text-slate-500">{step.state}</p>
              </div>
            ))}
          </div>
        </aside>

        <main className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          {pressureText ? (
            <div className="mb-3 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              {pressureText}
            </div>
          ) : null}

          {currentStep === "ACCEPTED_BY_CHIEF" ? (
            <ActionBlock
              title="Прийняття в роботу"
              description="Підтвердьте старт потоку у виробництві."
              ctaLabel="Прийняти в роботу"
              onClick={() => post(`/api/crm/production/flows/${flowId}/accept`)}
              busy={busy}
            />
          ) : null}

          {currentStep === "CONSTRUCTOR_ASSIGNED" ? (
            <div className="space-y-2">
              <p className="text-sm font-semibold">Призначення конструктора</p>
              <input
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                placeholder="ПІБ конструктора"
                value={constructorName}
                onChange={(event) => setConstructorName(event.target.value)}
              />
              <input
                type="date"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
              />
              <button
                disabled={busy || !constructorName.trim() || !dueDate}
                className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-medium text-white disabled:opacity-50"
                onClick={() =>
                  post(`/api/crm/production/flows/${flowId}/assign-constructor`, {
                    constructorMode: "OUTSOURCE",
                    constructorName: constructorName.trim(),
                    dueDate,
                  })
                }
              >
                Призначити конструктора
              </button>
            </div>
          ) : null}

          {currentStep === "CONSTRUCTOR_IN_PROGRESS" ? (
            <div className="space-y-2">
              <p className="text-sm font-semibold">Конструкторська робоча зона</p>
              {data.flow.constructorWorkspaceUrl ? (
                <a
                  className="inline-block text-xs font-medium text-sky-700 underline"
                  href={data.flow.constructorWorkspaceUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Відкрити робоче місце конструктора
                </a>
              ) : null}
              {data.flow.telegramThreadUrl ? (
                <a
                  className="inline-block text-xs text-slate-600 underline"
                  href={data.flow.telegramThreadUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Telegram / Комунікація
                </a>
              ) : null}
              <textarea
                rows={3}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                placeholder="Текст питання або коментар."
                value={questionText}
                onChange={(event) => setQuestionText(event.target.value)}
              />
              <button
                disabled={busy || !questionText.trim()}
                className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-medium text-white disabled:opacity-50"
                onClick={() =>
                  post(`/api/crm/production/flows/${flowId}/questions`, { text: questionText.trim() })
                }
              >
                Додати питання
              </button>
            </div>
          ) : null}

          {currentStep === "FILES_PACKAGE_UPLOADED" || currentStep === "FILES_VALIDATED" ? (
            <div className="space-y-2">
              <p className="text-sm font-semibold">Пакет файлів</p>
              <input
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                placeholder="Назва пакета"
                value={packageName}
                onChange={(event) => setPackageName(event.target.value)}
              />
              <input
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                placeholder="Версія"
                value={packageVersion}
                onChange={(event) => setPackageVersion(event.target.value)}
              />
              <div className="flex flex-wrap gap-2">
                <button
                  disabled={busy || !packageName.trim()}
                  className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-medium text-white disabled:opacity-50"
                  onClick={() =>
                    post(`/api/crm/production/flows/${flowId}/file-packages`, {
                      packageName: packageName.trim(),
                      versionLabel: packageVersion.trim() || "v1",
                      packageTypeTags: ["DXF", "SPEC"],
                      files: [{ fileName: "placeholder-spec.pdf", fileType: "pdf" }],
                    })
                  }
                >
                  Зареєструвати пакет
                </button>
                <button
                  disabled={busy}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium"
                  onClick={() => post(`/api/crm/production/flows/${flowId}/validate`)}
                >
                  Перевірити пакет
                </button>
              </div>
            </div>
          ) : null}

          {currentStep === "APPROVED_BY_CHIEF" ? (
            <div className="space-y-2">
              <p className="text-sm font-semibold">Апрув начальником виробництва</p>
              <p className="text-xs text-slate-600">Контекст: перевірений пакет файлів очікує фінального рішення.</p>
              <div className="flex gap-2">
                <button
                  disabled={busy || hasBlockers || openQuestions > 0}
                  className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-medium text-white"
                  onClick={() => post(`/api/crm/production/flows/${flowId}/approve`)}
                >
                  Апрув
                </button>
                <button
                  disabled={busy || !rejectionReason.trim()}
                  className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-900"
                  onClick={() =>
                    post(`/api/crm/production/flows/${flowId}/reject`, {
                      reason: rejectionReason.trim(),
                    })
                  }
                >
                  Повернути на доопрацювання
                </button>
              </div>
              <textarea
                rows={2}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                placeholder="Причина повернення"
                value={rejectionReason}
                onChange={(event) => setRejectionReason(event.target.value)}
              />
            </div>
          ) : null}

          {currentStep === "TASKS_DISTRIBUTED" ? (
            <ActionBlock
              title="Розподіл у закупівлю та виробництво"
              description="Автоматично створює закупівельні та виробничі задачі. Після завершення цеху створіть задачі монтажу."
              ctaLabel="Запустити розподіл"
              onClick={() => post(`/api/crm/production/flows/${flowId}/distribute`)}
              busy={busy}
              disabled={hasBlockers}
            />
          ) : null}

          {currentStep === "TASKS_DISTRIBUTED" ? (
            <div className="mt-2">
              <button
                disabled={busy}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium"
                onClick={() => post(`/api/crm/production/flows/${flowId}/create-installation`)}
              >
                Створити задачі монтажу
              </button>
            </div>
          ) : null}

          {error ? <p className="mt-3 text-xs text-rose-700">{error}</p> : null}
        </main>

        <aside className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm font-semibold">Оперативна аналітика</p>
          <ul className="space-y-2 text-xs">
            {data.insights.map((insight) => (
              <li key={insight.id}>
                <p className="font-medium">{insight.title}</p>
                <p className="text-slate-600">{insight.description}</p>
              </li>
            ))}
          </ul>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold text-slate-800">Telegram / Комунікація</p>
            <ul className="mt-2 space-y-1 text-xs text-slate-600">
              {data.questions.slice(0, 6).map((question) => (
                <li key={question.id}>
                  [{question.status}] {question.text}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-3">
            <p className="text-xs font-semibold text-rose-900">Блокери</p>
            <ul className="mt-2 space-y-1 text-xs text-rose-800">
              {blockers.length === 0 ? (
                <li>Немає активних блокерів.</li>
              ) : (
                blockers.map((blocker) => <li key={blocker.id}>- {blocker.title}</li>)
              )}
            </ul>
          </div>
        </aside>
      </section>
    </div>
  );
}

function ActionBlock({
  title,
  description,
  ctaLabel,
  onClick,
  busy,
  disabled = false,
}: {
  title: string;
  description: string;
  ctaLabel: string;
  onClick: () => Promise<void>;
  busy: boolean;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold">{title}</p>
      <p className="text-xs text-slate-600">{description}</p>
      <button
        disabled={busy || disabled}
        className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-medium text-white disabled:opacity-50"
        onClick={() => void onClick()}
      >
        {ctaLabel}
      </button>
    </div>
  );
}
