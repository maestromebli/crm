"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  ProductionCommandCenterView,
  ProductionFlowStatus,
  ProductionQueueItem,
  ProductionStepKey,
} from "../../types/production";
import {
  WORKSHOP_KANBAN_STAGE_KEYS,
  WORKSHOP_MINI_HQ_STAGE_KEYS,
  WORKSHOP_STAGE_LABEL_UK,
  workshopStageHref,
  type WorkshopKanbanStageKey,
} from "../../workshop-stages";

const POLL_MS = { fast: 12_000, normal: 25_000, slow: 45_000 } as const;

const STEP_LABELS: Record<ProductionStepKey, string> = {
  ACCEPTED_BY_CHIEF: "Прийом",
  CONSTRUCTOR_ASSIGNED: "Конструктор",
  CONSTRUCTOR_IN_PROGRESS: "Конструктор (робота)",
  FILES_PACKAGE_UPLOADED: "Пакет файлів",
  FILES_VALIDATED: "Валідація",
  APPROVED_BY_CHIEF: "Апрув керівника",
  TASKS_DISTRIBUTED: "Розподіл задач",
};

const STATUS_LABELS: Record<ProductionFlowStatus, string> = {
  NEW: "Новий",
  ACTIVE: "Активний",
  ON_HOLD: "Пауза",
  BLOCKED: "Блок",
  READY_FOR_PROCUREMENT_AND_WORKSHOP: "Готово до закупівлі/цеху",
  IN_WORKSHOP: "У цеху",
  READY_FOR_INSTALLATION: "До монтажу",
  DONE: "Завершено",
  CANCELLED: "Скасовано",
};

const PIPELINE_ORDER: ProductionStepKey[] = [
  "ACCEPTED_BY_CHIEF",
  "CONSTRUCTOR_ASSIGNED",
  "CONSTRUCTOR_IN_PROGRESS",
  "FILES_PACKAGE_UPLOADED",
  "FILES_VALIDATED",
  "APPROVED_BY_CHIEF",
  "TASKS_DISTRIBUTED",
];

function formatRelativeUk(iso: string, nowMs: number): string {
  const t = new Date(iso).getTime();
  const sec = Math.max(0, Math.floor((nowMs - t) / 1000));
  if (sec < 60) return `${sec} с тому`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} хв тому`;
  const h = Math.floor(min / 60);
  return `${h} год тому`;
}

/** Same string on server and first client paint — avoids hydration mismatch from Date.now(). */
function formatSyncedAtStatic(iso: string): string {
  return iso.replace("T", " ").replace(/\.\d{3}Z?$/, "").replace(/Z$/, "");
}

/** Людський дедлайн відвантаження / здачі (оновлюється на клієнті). */
function formatDeadlineHuman(iso: string | null, nowMs: number): { text: string; warn: boolean } {
  if (!iso) return { text: "—", warn: false };
  const end = new Date(iso).getTime();
  const d = Math.ceil((end - nowMs) / (24 * 60 * 60 * 1000));
  if (d < 0) return { text: `прострочено ${Math.abs(d)} дн.`, warn: true };
  if (d === 0) return { text: "сьогодні", warn: true };
  if (d <= 3) return { text: `через ${d} дн.`, warn: true };
  return { text: `через ${d} дн.`, warn: false };
}

function openWorkshopMiniHqWindow(stageKey: WorkshopKanbanStageKey) {
  if (typeof window === "undefined") return;
  const url = `${window.location.origin}${workshopStageHref(stageKey)}`;
  window.open(url, `_blank_${stageKey}`, "noopener,noreferrer,width=1560,height=920");
}

export function ProductionCommandCenterPage({ data: initial }: { data: ProductionCommandCenterView }) {
  const [data, setData] = useState<ProductionCommandCenterView>(initial);
  const [pollKey, setPollKey] = useState<keyof typeof POLL_MS>("normal");
  const [fetching, setFetching] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [filter, setFilter] = useState<"all" | "problems" | "critical">("all");
  const [query, setQuery] = useState("");

  const refresh = useCallback(async () => {
    setFetching(true);
    setLastError(null);
    try {
      const res = await fetch("/api/crm/production/command-center", { credentials: "include", cache: "no-store" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(typeof err.error === "string" ? err.error : `HTTP ${res.status}`);
      }
      const next = (await res.json()) as ProductionCommandCenterView;
      setData(next);
    } catch (e) {
      setLastError(e instanceof Error ? e.message : "Помилка оновлення");
    } finally {
      setFetching(false);
    }
  }, []);

  useEffect(() => {
    const ms = POLL_MS[pollKey];
    const id = window.setInterval(() => {
      void refresh();
    }, ms);
    return () => window.clearInterval(id);
  }, [pollKey, refresh]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setTick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [refresh]);

  const problemFlows = useMemo(
    () =>
      data.queue.filter(
        (row) =>
          row.riskScore >= 70 ||
          row.blockersCount > 0 ||
          (row.dueDate ? new Date(row.dueDate).getTime() < Date.now() : false),
      ),
    [data.queue],
  );

  const pipelineCounts = useMemo(() => {
    const m = new Map<ProductionStepKey, number>();
    for (const k of PIPELINE_ORDER) m.set(k, 0);
    for (const row of data.queue) {
      const k = row.currentStepKey;
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return m;
  }, [data.queue]);

  const maxPipeline = useMemo(() => Math.max(1, ...PIPELINE_ORDER.map((k) => pipelineCounts.get(k) ?? 0)), [pipelineCounts]);

  const workshopTotal = useMemo(
    () => data.workshopKanban.reduce((s, col) => s + col.tasks.length, 0),
    [data.workshopKanban],
  );

  const filteredQueue = useMemo(() => {
    const q = query.trim().toLowerCase();
    let rows: ProductionQueueItem[] = data.queue;
    if (filter === "problems") rows = problemFlows;
    if (filter === "critical")
      rows = data.queue.filter(
        (r) => r.riskScore >= 85 || r.blockersCount > 0 || (r.dueDate && new Date(r.dueDate).getTime() < Date.now()),
      );
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.number.toLowerCase().includes(q) ||
        r.clientName.toLowerCase().includes(q) ||
        r.title.toLowerCase().includes(q),
    );
  }, [data.queue, filter, problemFlows, query]);

  const healthScore = useMemo(() => {
    const { kpis } = data;
    const procurementOverdue = kpis.procurementOverdue ?? 0;
    const pressure =
      kpis.blockedFlows * 12 + kpis.highRiskFlows * 8 + kpis.overdueFlows * 10 + procurementOverdue * 8;
    const cap = Math.max(1, kpis.activeFlows * 6);
    return Math.max(0, Math.min(100, Math.round(100 - (pressure / cap) * 100)));
  }, [data.kpis]);

  const syncedRel = useMemo(
    () => formatRelativeUk(data.syncedAt, Date.now()),
    [data.syncedAt, tick, mounted],
  );
  const syncedLabel = mounted ? syncedRel : formatSyncedAtStatic(data.syncedAt);

  return (
    <div className="space-y-5">
      <header className="relative overflow-hidden rounded-2xl border border-slate-800/80 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-5 text-slate-100 shadow-xl">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.06) 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight text-white md:text-3xl">Штаб виробництва</h1>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wide text-emerald-300">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                </span>
                Живий моніторинг
              </span>
            </div>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
              Єдиний екран контролю потоку по цеху: конструкторська, файли, закупівля, склад, виробництво та монтаж — оновлення
              з сервера без перезавантаження сторінки. Окремі міні-штаби для порізки, поклейки, присадки та збірки відкривають лише
              потрібну дільницю — зручно для операторів на робочих місцях.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-white/10 pt-3 text-[11px]">
              <span className="text-slate-500">Класичні списки угод:</span>
              <Link
                href="/production/in-progress"
                className="font-medium text-sky-200/95 underline-offset-2 hover:text-white hover:underline"
              >
                на лінії
              </Link>
              <span className="text-slate-600">·</span>
              <Link
                href="/production/delays"
                className="font-medium text-sky-200/95 underline-offset-2 hover:text-white hover:underline"
              >
                затримки
              </Link>
              <span className="text-slate-600">·</span>
              <Link
                href="/production/ready-install"
                className="font-medium text-sky-200/95 underline-offset-2 hover:text-white hover:underline"
              >
                до монтажу
              </Link>
              <span className="text-slate-600">·</span>
              <Link
                href="/production/installation-schedule"
                className="font-medium text-sky-200/95 underline-offset-2 hover:text-white hover:underline"
              >
                графік монтажу
              </Link>
              <span className="text-slate-600">·</span>
              <Link
                href="/crm/procurement"
                className="font-medium text-emerald-200/95 underline-offset-2 hover:text-white hover:underline"
              >
                закупівлі (хаб)
              </Link>
              <span className="text-slate-600">·</span>
              <Link
                href="/warehouse"
                className="font-medium text-emerald-200/95 underline-offset-2 hover:text-white hover:underline"
              >
                склад WMS
              </Link>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                href="/crm/production/workshop"
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-white/10"
              >
                Повний Kanban
              </Link>
              {WORKSHOP_MINI_HQ_STAGE_KEYS.map((stageKey) => (
                <Link
                  key={stageKey}
                  href={workshopStageHref(stageKey)}
                  className="rounded-lg border border-emerald-500/35 bg-emerald-500/10 px-2.5 py-1.5 text-[11px] font-medium text-emerald-100 transition hover:bg-emerald-500/20"
                >
                  Міні: {WORKSHOP_STAGE_LABEL_UK[stageKey]}
                </Link>
              ))}
              <button
                type="button"
                onClick={() => void refresh()}
                disabled={fetching}
                className="rounded-lg border border-sky-500/40 bg-sky-500/20 px-3 py-1.5 text-xs font-medium text-sky-100 transition hover:bg-sky-500/30 disabled:opacity-60"
              >
                {fetching ? "Оновлення…" : "Оновити зараз"}
              </button>
            </div>
          </div>
          <div className="flex w-full flex-col gap-3 rounded-xl border border-white/10 bg-black/25 p-4 text-sm lg:max-w-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-400">Інтервал автооновлення</span>
              <select
                value={pollKey}
                onChange={(e) => setPollKey(e.target.value as keyof typeof POLL_MS)}
                className="rounded-md border border-white/20 bg-slate-900/80 px-2 py-1 text-xs text-white outline-none focus:ring-2 focus:ring-sky-500/50"
              >
                <option value="fast">~12 с</option>
                <option value="normal">~25 с</option>
                <option value="slow">~45 с</option>
              </select>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Синхронізація</span>
              <span className="font-mono text-emerald-200/90">{syncedLabel}</span>
            </div>
            {lastError ? <p className="text-xs text-rose-300">{lastError}</p> : null}
            <div className="flex items-center justify-between border-t border-white/10 pt-2">
              <span className="text-xs text-slate-500">Операційний індекс цеху</span>
              <span className="text-lg font-semibold tabular-nums text-white">{healthScore}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-800">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  healthScore >= 70 ? "bg-emerald-500" : healthScore >= 40 ? "bg-amber-500" : "bg-rose-500"
                }`}
                style={{ width: `${healthScore}%` }}
              />
            </div>
          </div>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {WORKSHOP_MINI_HQ_STAGE_KEYS.map((stageKey) => {
          const col = data.workshopKanban.find((c) => c.stageKey === stageKey);
          const n = col?.tasks.length ?? 0;
          return (
            <article
              key={stageKey}
              className="enver-panel enver-panel--interactive relative overflow-hidden bg-gradient-to-br from-[var(--enver-card)] via-[var(--enver-surface)] to-[var(--enver-accent-soft)] p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-[var(--enver-text)]">{WORKSHOP_STAGE_LABEL_UK[stageKey]}</h3>
                  <p className="mt-0.5 text-[11px] text-[var(--enver-text-muted)]">Міні-штаб дільниці</p>
                </div>
                <span className="rounded-full bg-[var(--enver-text)] px-2.5 py-0.5 text-lg font-semibold tabular-nums text-[var(--enver-card)]">{n}</span>
              </div>
              <p className="mt-3 text-[11px] leading-snug text-[var(--enver-text-muted)]">
                Картки та чекліст матеріалів тільки для цієї стадії — без зайвих колонок.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link
                  href={workshopStageHref(stageKey)}
                  className="inline-flex flex-1 items-center justify-center rounded-lg bg-[var(--enver-accent)] px-3 py-2 text-[11px] font-medium text-white transition hover:bg-[var(--enver-accent-hover)]"
                >
                  Відкрити стіл
                </Link>
                <button
                  type="button"
                  onClick={() => openWorkshopMiniHqWindow(stageKey)}
                  className="rounded-lg border border-[var(--enver-border)] bg-[var(--enver-card)] px-3 py-2 text-[11px] font-medium text-[var(--enver-text)] transition hover:bg-[var(--enver-hover)]"
                >
                  У вікні
                </button>
              </div>
            </article>
          );
        })}
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
        <KpiCard
          label="Активні потоки"
          value={data.kpis.activeFlows}
          accent={data.kpis.activeFlows > 0 ? "neutral" : "muted"}
        />
        <KpiCard label="Заблоковані" value={data.kpis.blockedFlows} accent={data.kpis.blockedFlows > 0 ? "danger" : "ok"} />
        <KpiCard label="Середня готовність" value={`${data.kpis.averageReadiness}%`} accent="neutral" />
        <KpiCard label="Високий AI-ризик" value={data.kpis.highRiskFlows} accent={data.kpis.highRiskFlows > 0 ? "warn" : "ok"} />
        <KpiCard label="Прострочені (дедлайн)" value={data.kpis.overdueFlows} accent={data.kpis.overdueFlows > 0 ? "danger" : "ok"} />
        <KpiCard label="Готові до розподілу" value={data.kpis.readyToDistribute} accent="highlight" />
        <KpiCard
          label="Закупівлі відкриті"
          value={data.kpis.procurementPending ?? 0}
          accent={(data.kpis.procurementPending ?? 0) > 0 ? "neutral" : "muted"}
        />
        <KpiCard
          label="Простроч. постачання"
          value={data.kpis.procurementOverdue ?? 0}
          accent={(data.kpis.procurementOverdue ?? 0) > 0 ? "danger" : "ok"}
        />
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Воронка етапів (активні потоки)</h2>
            <p className="text-xs text-slate-500">Скільки замовлень зараз на кожному кроці пайплайна</p>
          </div>
          <span className="text-xs text-slate-500">{data.queue.length} у черзі штабу</span>
        </div>
        <div className="flex flex-wrap gap-2 lg:flex-nowrap lg:gap-1">
          {PIPELINE_ORDER.map((key) => {
            const n = pipelineCounts.get(key) ?? 0;
            const h = Math.round((n / maxPipeline) * 100);
            return (
              <div
                key={key}
                className="min-w-[100px] flex-1 rounded-xl border border-slate-100 bg-slate-50/80 px-2 py-2 text-center"
              >
                <div className="mx-auto mb-2 flex h-16 w-8 items-end justify-center rounded-md bg-slate-200/80">
                  <div
                    className="w-full rounded-md bg-gradient-to-t from-sky-600 to-sky-400 transition-all duration-500"
                    style={{ height: `${Math.max(8, h)}%` }}
                  />
                </div>
                <p className="text-[10px] font-medium leading-tight text-slate-600">{STEP_LABELS[key]}</p>
                <p className="mt-0.5 text-lg font-semibold tabular-nums text-slate-900">{n}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-gradient-to-b from-white to-slate-50/80 p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Цех у реальному часі</h2>
            <p className="text-xs text-slate-500">
              Задачі WORKSHOP по стадіях · загалом {workshopTotal} активних карток
            </p>
          </div>
          <Link href="/crm/production/workshop" className="text-xs font-medium text-sky-700 underline-offset-2 hover:underline">
            Повний Kanban
          </Link>
        </div>
        {data.workshopBottleneck && data.workshopBottleneck.totalWorkshopTasks > 0 ? (
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200/90 bg-amber-50/90 px-3 py-2 text-xs text-amber-950">
            <p>
              <span className="font-semibold">Вузьке місце: </span>
              {data.workshopBottleneck.stageLabel} — {data.workshopBottleneck.taskCount} з{" "}
              {data.workshopBottleneck.totalWorkshopTasks} карток ({data.workshopBottleneck.sharePercent}%).
            </p>
            {WORKSHOP_KANBAN_STAGE_KEYS.includes(data.workshopBottleneck.stageKey as WorkshopKanbanStageKey) ? (
              <Link
                href={workshopStageHref(data.workshopBottleneck.stageKey as WorkshopKanbanStageKey)}
                className="shrink-0 font-medium text-amber-900 underline-offset-2 hover:underline"
              >
                Відкрити колонку
              </Link>
            ) : null}
          </div>
        ) : null}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {data.workshopKanban.map((col) => (
            <div
              key={col.stageKey}
              className="min-w-[160px] shrink-0 rounded-xl border border-slate-200 bg-white p-2 shadow-sm"
            >
              <div className="mb-2 flex items-center justify-between border-b border-slate-100 pb-1">
                <Link
                  href={workshopStageHref(col.stageKey as WorkshopKanbanStageKey)}
                  className="text-[11px] font-semibold text-sky-800 hover:underline"
                >
                  {col.stageLabel}
                </Link>
                <span className="rounded-full bg-slate-100 px-1.5 text-[10px] tabular-nums text-slate-600">
                  {col.tasks.length}
                </span>
              </div>
              <ul className="max-h-48 space-y-1.5 overflow-y-auto text-[11px]">
                {col.tasks.slice(0, 6).map((t) => {
                  const m = t.materialsChecklist;
                  const doneMat = m.filter((x) => x.done).length;
                  return (
                    <li key={t.id} className="rounded border border-slate-100 bg-slate-50/90 px-1.5 py-1">
                      <p className="font-medium text-slate-800">{t.flowNumber}</p>
                      <p className="line-clamp-2 text-slate-600">{t.title}</p>
                      {t.assigneeName ? (
                        <p className="mt-0.5 truncate text-[10px] text-slate-500" title={t.assigneeName}>
                          Збірник: {t.assigneeName}
                        </p>
                      ) : (
                        <p className="mt-0.5 text-[10px] text-amber-700/90">Збірник не призначено</p>
                      )}
                      {m.length > 0 ? (
                        <p className="mt-0.5 text-[10px] tabular-nums text-emerald-800">
                          Матеріали: {doneMat}/{m.length}
                        </p>
                      ) : (
                        <p className="mt-0.5 text-[10px] text-slate-400">Чекліст порожній</p>
                      )}
                      <PriorityDot p={t.priority} />
                    </li>
                  );
                })}
                {col.tasks.length === 0 ? <li className="text-slate-400">—</li> : null}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Операційна черга</h2>
            <p className="text-xs text-slate-500">Фільтри та пошук — миттєво на клієнті</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="search"
              placeholder="Номер, клієнт, виріб…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="min-w-[180px] rounded-lg border border-slate-200 px-3 py-1.5 text-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
            />
            <div className="flex rounded-lg border border-slate-200 p-0.5 text-xs">
              {(
                [
                  ["all", "Усі"],
                  ["problems", "Ризик"],
                  ["critical", "Критично"],
                ] as const
              ).map(([k, lab]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setFilter(k)}
                  className={`rounded-md px-2 py-1 font-medium transition ${
                    filter === k ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {lab}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="overflow-x-auto rounded-xl border border-slate-100">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr>
                <th className="px-3 py-2.5 font-medium">№</th>
                <th className="px-3 py-2.5 font-medium">Клієнт</th>
                <th className="px-3 py-2.5 font-medium">Виріб</th>
                <th className="px-3 py-2.5 font-medium">Дедлайн</th>
                <th className="px-3 py-2.5 font-medium">Етап</th>
                <th className="px-3 py-2.5 font-medium">Статус</th>
                <th className="px-3 py-2.5 font-medium">Готовність</th>
                <th className="px-3 py-2.5 font-medium">Ризик</th>
                <th className="px-3 py-2.5 font-medium">Дія</th>
              </tr>
            </thead>
            <tbody>
              {filteredQueue.map((row) => {
                const hot =
                  row.riskScore >= 70 || row.blockersCount > 0 || (row.dueDate && new Date(row.dueDate).getTime() < Date.now());
                const nowMs = mounted ? Date.now() : new Date(data.syncedAt).getTime();
                const dueHuman = formatDeadlineHuman(row.dueDate, nowMs);
                return (
                  <tr
                    key={row.id}
                    className={`border-t border-slate-100 ${hot ? "bg-rose-50/40" : "hover:bg-slate-50/80"}`}
                  >
                    <td className="px-3 py-2.5 font-medium text-slate-900">{row.number}</td>
                    <td className="px-3 py-2.5 text-slate-700">{row.clientName}</td>
                    <td className="max-w-[200px] truncate px-3 py-2.5 text-slate-700" title={row.title}>
                      {row.title}
                    </td>
                    <td className="px-3 py-2.5 text-xs">
                      {row.dueDate ? (
                        <span
                          className={
                            dueHuman.warn
                              ? "font-medium text-rose-700"
                              : mounted
                                ? "text-slate-700"
                                : "text-slate-500"
                          }
                        >
                          {mounted ? dueHuman.text : row.dueDate.slice(0, 10)}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-slate-600">{STEP_LABELS[row.currentStepKey]}</td>
                    <td className="px-3 py-2.5">
                      <StatusPill status={row.status} />
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-28 overflow-hidden rounded-full bg-slate-200">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-sky-500 to-cyan-400 transition-all"
                            style={{ width: `${row.readinessPercent}%` }}
                          />
                        </div>
                        <span className="text-xs tabular-nums text-slate-600">{row.readinessPercent}%</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className={`inline-flex min-w-[2rem] justify-center rounded-md px-1.5 py-0.5 text-xs font-medium tabular-nums ${
                          row.riskScore >= 70
                            ? "bg-rose-100 text-rose-800"
                            : row.riskScore >= 40
                              ? "bg-amber-100 text-amber-900"
                              : "bg-emerald-50 text-emerald-800"
                        }`}
                      >
                        {row.riskScore}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <Link
                        className="font-medium text-sky-700 underline-offset-2 hover:underline"
                        href={`/crm/production/${row.id}`}
                      >
                        Штаб замовлення
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filteredQueue.length === 0 ? (
            <p className="border-t border-slate-100 px-3 py-6 text-center text-sm text-slate-500">Нічого не знайдено за фільтром.</p>
          ) : null}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-rose-200/80 bg-gradient-to-br from-rose-50 to-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-rose-950">Потоки під тиском</h3>
          <p className="mt-0.5 text-xs text-rose-800/80">Прострочення, блокери або ризик ≥ 70</p>
          <ul className="mt-3 max-h-64 space-y-2 overflow-y-auto text-xs">
            {problemFlows.length === 0 ? (
              <li className="rounded-lg border border-rose-100 bg-white/80 px-2 py-2 text-rose-800">Критичних сигналів немає.</li>
            ) : (
              problemFlows.slice(0, 10).map((flow) => (
                <li key={flow.id} className="rounded-lg border border-rose-100 bg-white px-2 py-2 shadow-sm">
                  <p className="font-semibold text-slate-900">{flow.number}</p>
                  <p className="text-slate-600">
                    Ризик {flow.riskScore} · Блокери {flow.blockersCount}
                    {flow.openQuestionsCount ? ` · Питання ${flow.openQuestionsCount}` : ""}
                  </p>
                  {flow.dueDate ? (
                    <p
                      className={`mt-1 text-[11px] font-medium ${
                        new Date(flow.dueDate).getTime() < (mounted ? Date.now() : new Date(data.syncedAt).getTime())
                          ? "text-rose-700"
                          : "text-amber-800"
                      }`}
                    >
                      Дедлайн:{" "}
                      {formatDeadlineHuman(flow.dueDate, mounted ? Date.now() : new Date(data.syncedAt).getTime()).text}
                    </p>
                  ) : null}
                  <div className="mt-1.5 flex gap-2">
                    <Link className="font-medium text-sky-700 hover:underline" href={`/crm/production/${flow.id}`}>
                      Відкрити штаб
                    </Link>
                  </div>
                </li>
              ))
            )}
          </ul>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">Завантаження дільниць</h3>
            <Link href="/crm/production/workshop" className="text-[11px] font-medium text-sky-700 hover:underline">
              Цех
            </Link>
          </div>
          <div className="mt-3 space-y-3">
            {data.stationLoads.length === 0 ? (
              <p className="text-xs text-slate-500">Немає даних по станціях.</p>
            ) : (
              data.stationLoads.map((station) => (
                <div key={station.stationKey}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-700">{station.stationLabel}</span>
                    <span className="tabular-nums text-slate-600">{station.loadPercent}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${
                        station.loadPercent >= 85 ? "bg-gradient-to-r from-rose-500 to-orange-400" : "bg-gradient-to-r from-emerald-500 to-teal-400"
                      }`}
                      style={{ width: `${Math.min(100, station.loadPercent)}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900">Критичні блокери</h3>
          <ul className="mt-3 max-h-48 space-y-2 overflow-y-auto text-xs">
            {data.criticalBlockers.length === 0 ? (
              <li className="text-slate-500">Немає записів.</li>
            ) : (
              data.criticalBlockers.map((item) => (
                <li key={`${item.flowId}-${item.message}`} className="border-b border-slate-100 pb-2 last:border-0">
                  <p className="font-semibold text-slate-900">{item.number}</p>
                  <p className="text-slate-600">{item.message}</p>
                </li>
              ))
            )}
          </ul>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:col-span-3">
          <h3 className="text-sm font-semibold text-slate-900">Наступні дії (AI / ризики)</h3>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {data.nextActions.slice(0, 9).map((item) => (
              <div key={`${item.flowId}-${item.description}`} className="rounded-xl border border-slate-100 bg-slate-50/80 p-3 text-xs">
                <p className="font-semibold text-slate-900">{item.number}</p>
                <p className="mt-1 line-clamp-3 text-slate-600">{item.description}</p>
                <Link className="mt-2 inline-block font-medium text-sky-700 hover:underline" href={`/crm/production/${item.flowId}`}>
                  {item.ctaLabel}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Журнал подій виробництва</h2>
            <p className="text-xs text-slate-500">Останні рішення та переходи по потоках (аудит)</p>
          </div>
        </div>
        <ul className="max-h-56 space-y-2 overflow-y-auto text-xs">
          {(data.recentEvents ?? []).length === 0 ? (
            <li className="text-slate-500">
              Події з&apos;являться після руху по етапах (записи ProductionEvent у базі).
            </li>
          ) : (
            (data.recentEvents ?? []).map((ev) => (
              <li
                key={ev.id}
                className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 pb-2 last:border-0"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-900">{ev.flowNumber}</p>
                  <p className="text-slate-700">{ev.title}</p>
                  {ev.description ? <p className="mt-0.5 text-slate-500">{ev.description}</p> : null}
                  {ev.actorName ? <p className="mt-0.5 text-[10px] text-slate-500">{ev.actorName}</p> : null}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className="whitespace-nowrap font-mono text-[10px] text-slate-400">
                    {mounted ? formatRelativeUk(ev.createdAt, Date.now()) : ev.createdAt.slice(0, 16).replace("T", " ")}
                  </span>
                  <Link href={`/crm/production/${ev.flowId}`} className="font-medium text-sky-700 hover:underline">
                    Штаб
                  </Link>
                </div>
              </li>
            ))
          )}
        </ul>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-slate-900">Закупівля</h3>
            <Link href="/crm/procurement" className="text-[11px] font-medium text-sky-700 hover:underline">
              Хаб закупівель
            </Link>
          </div>
          <ul className="mt-3 max-h-52 space-y-2 overflow-y-auto text-xs">
            {data.procurement.slice(0, 10).map((item) => {
              const procurementLate =
                item.status !== "DELIVERED" &&
                item.expectedDate &&
                new Date(item.expectedDate).getTime() < (mounted ? Date.now() : new Date(data.syncedAt).getTime());
              return (
                <li
                  key={item.id}
                  className={`rounded-lg border px-2 py-1.5 ${
                    procurementLate ? "border-rose-200 bg-rose-50/60" : "border-slate-100 bg-slate-50/50"
                  }`}
                >
                  <p className="font-semibold text-slate-900">{item.flowNumber}</p>
                  <p className="text-slate-700">{item.title}</p>
                  <p className="text-slate-500">
                    {item.status}
                    {item.supplier ? ` · ${item.supplier}` : ""}
                  </p>
                  {item.expectedDate ? (
                    <p className={`mt-0.5 text-[11px] ${procurementLate ? "font-medium text-rose-800" : "text-slate-500"}`}>
                      Очікується: {item.expectedDate.slice(0, 10)}
                      {procurementLate ? " · прострочено" : ""}
                    </p>
                  ) : null}
                  <Link
                    href={`/crm/production/${item.flowId}`}
                    className="mt-1 inline-block font-medium text-sky-700 hover:underline"
                  >
                    Штаб замовлення
                  </Link>
                </li>
              );
            })}
            {data.procurement.length === 0 ? <li className="text-slate-500">Немає задач закупівлі.</li> : null}
          </ul>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900">Склад</h3>
          <ul className="mt-3 max-h-52 space-y-2 overflow-y-auto text-xs">
            {data.warehouse.slice(0, 10).map((item, index) => (
              <li key={`${item.flowId}-${item.material}-${index}`} className="rounded-lg border border-slate-100 bg-slate-50/50 px-2 py-1.5">
                <p className="font-semibold text-slate-900">{item.flowNumber}</p>
                <p className="text-slate-700">{item.material}</p>
                <p className="text-slate-500">{item.reserved ? "зарезервовано" : "вільно"}</p>
              </li>
            ))}
            {data.warehouse.length === 0 ? <li className="text-slate-500">Немає позицій.</li> : null}
          </ul>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900">Монтаж</h3>
          <ul className="mt-3 max-h-52 space-y-2 overflow-y-auto text-xs">
            {data.installation.slice(0, 10).map((item) => (
              <li key={item.id} className="rounded-lg border border-slate-100 bg-slate-50/50 px-2 py-1.5">
                <p className="font-semibold text-slate-900">{item.flowNumber}</p>
                <p className="text-slate-700">{item.title}</p>
                <p className="text-slate-500">{item.status}</p>
              </li>
            ))}
            {data.installation.length === 0 ? <li className="text-slate-500">Немає монтажних задач.</li> : null}
          </ul>
        </div>
      </section>
    </div>
  );
}

function PriorityDot({ p }: { p: "LOW" | "NORMAL" | "HIGH" | "URGENT" }) {
  const cls =
    p === "URGENT"
      ? "bg-rose-500"
      : p === "HIGH"
        ? "bg-orange-500"
        : p === "NORMAL"
          ? "bg-sky-400"
          : "bg-slate-300";
  return (
    <span className="mt-1 inline-flex items-center gap-1 text-[10px] text-slate-500">
      <span className={`h-1.5 w-1.5 rounded-full ${cls}`} />
      {p}
    </span>
  );
}

function StatusPill({ status }: { status: ProductionFlowStatus }) {
  const label = STATUS_LABELS[status] ?? status;
  const cls =
    status === "BLOCKED"
      ? "bg-rose-100 text-rose-900"
      : status === "ON_HOLD"
        ? "bg-amber-100 text-amber-950"
        : status === "DONE" || status === "CANCELLED"
          ? "bg-slate-100 text-slate-700"
          : status === "IN_WORKSHOP" || status === "READY_FOR_INSTALLATION"
            ? "bg-violet-100 text-violet-900"
            : "bg-emerald-50 text-emerald-900";
  return <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${cls}`}>{label}</span>;
}

function KpiCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent: "neutral" | "danger" | "warn" | "ok" | "muted" | "highlight";
}) {
  const ring =
    accent === "danger"
      ? "ring-1 ring-rose-200 shadow-rose-100/50"
      : accent === "warn"
        ? "ring-1 ring-amber-200"
        : accent === "highlight"
          ? "ring-1 ring-sky-200 bg-gradient-to-br from-white to-sky-50/50"
          : accent === "ok"
            ? "ring-1 ring-emerald-100/80"
            : "";
  return (
    <article className={`rounded-2xl border border-slate-200 bg-white p-3 shadow-sm ${ring}`}>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-slate-900">{value}</p>
    </article>
  );
}
