"use client";

import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import type { ProductionCommandCenterView } from "../../types/production";
import { buildOrderViewModels } from "./models";
import { getCapacitySummary, getPlanningQuickFilters, getQueueHealthSummary } from "./planning-selectors";

const POLL_MS = 60_000;
type CommandCenterTab = "overview" | "queue" | "workshops";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function formatRelative(iso: string, nowMs: number): string {
  const t = new Date(iso).getTime();
  const seconds = Math.max(0, Math.floor((nowMs - t) / 1000));
  if (seconds < 60) return `${seconds}с тому`;
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}хв тому`;
  return `${Math.floor(mins / 60)}г тому`;
}

function getDueInDays(iso: string | null, nowMs: number): number | null {
  if (!iso) return null;
  const dueTime = new Date(iso).getTime();
  if (Number.isNaN(dueTime)) return null;
  return Math.ceil((dueTime - nowMs) / (24 * 60 * 60 * 1000));
}

function dueLabel(iso: string | null, nowMs: number): string {
  const days = getDueInDays(iso, nowMs);
  if (days === null) return "Без дедлайну";
  if (days < 0) return `${Math.abs(days)}дн прострочено`;
  if (days === 0) return "Термін сьогодні";
  return `${days}дн до дедлайну`;
}

function loadTone(loadPercent: number): string {
  if (loadPercent >= 90) return "bg-rose-500";
  if (loadPercent >= 75) return "bg-amber-500";
  return "bg-emerald-500";
}

function buildSparklinePoints(values: number[], width = 240, height = 56, padding = 6): string {
  if (values.length === 0) return "";
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(1, max - min);
  const step = values.length === 1 ? 0 : (width - padding * 2) / (values.length - 1);
  return values
    .map((value, index) => {
      const x = padding + index * step;
      const y = height - padding - ((value - min) / range) * (height - padding * 2);
      return `${x},${y}`;
    })
    .join(" ");
}

export function ProductionCommandCenter({ data: initial }: { data: ProductionCommandCenterView }) {
  const [data, setData] = useState(initial);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [filter, setFilter] = useState("all");
  const [activeTab, setActiveTab] = useState<CommandCenterTab>("queue");
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(initial.queue[0]?.id ?? null);
  const [fetching, setFetching] = useState(false);
  const [nowMs, setNowMs] = useState<number>(() => {
    const syncedAtTime = new Date(initial.syncedAt).getTime();
    return Number.isNaN(syncedAtTime) ? 0 : syncedAtTime;
  });

  const refresh = useCallback(async () => {
    if (document.visibilityState !== "visible") return;
    setFetching(true);
    try {
      const res = await fetch("/api/crm/production/command-center", { credentials: "include", cache: "no-store" });
      if (!res.ok) return;
      setData((await res.json()) as ProductionCommandCenterView);
      setNowMs(Date.now());
    } finally {
      setFetching(false);
    }
  }, []);

  useEffect(() => {
    if (document.visibilityState === "visible") {
      void refresh();
    }
    const id = window.setInterval(() => void refresh(), POLL_MS);
    const onVisibility = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [refresh]);

  const quickFilters = useMemo(() => getPlanningQuickFilters(data), [data]);
  const selectedFilter = useMemo(
    () => quickFilters.find((item) => item.id === filter) ?? quickFilters[0],
    [filter, quickFilters],
  );

  const filteredQueue = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    const rows = data.queue.filter((row) => selectedFilter.predicate(row));
    if (!q) return rows;
    return rows.filter(
      (row) => row.number.toLowerCase().includes(q) || row.clientName.toLowerCase().includes(q) || row.title.toLowerCase().includes(q),
    );
  }, [data.queue, deferredQuery, selectedFilter]);

  const filteredData = useMemo(() => ({ ...data, queue: filteredQueue }), [data, filteredQueue]);
  const orderRows = useMemo(() => buildOrderViewModels(filteredData), [filteredData]);
  const selectedOrder = useMemo(
    () => orderRows.find((item) => item.order.id === selectedOrderId) ?? orderRows[0] ?? null,
    [orderRows, selectedOrderId],
  );

  const selectedOrderBlockers = useMemo(
    () => data.criticalBlockers.filter((item) => item.flowId === selectedOrder?.order.id),
    [data.criticalBlockers, selectedOrder?.order.id],
  );
  const selectedOrderActions = useMemo(
    () => data.nextActions.filter((item) => item.flowId === selectedOrder?.order.id),
    [data.nextActions, selectedOrder?.order.id],
  );

  const queueHealth = useMemo(() => getQueueHealthSummary(filteredQueue), [filteredQueue]);
  const capacitySummary = useMemo(() => getCapacitySummary(data), [data]);

  const stationStats = useMemo(() => {
    return data.stationLoads.map((station) => {
      const inQueue = orderRows.filter((row) => row.workshopAssignment === station.stationLabel).length;
      const overdue = orderRows.filter(
        (row) => row.workshopAssignment === station.stationLabel && row.deadlineRisk === "overdue",
      ).length;
      return { ...station, inQueue, overdue };
    });
  }, [data.stationLoads, orderRows]);

  const eventTrend = useMemo(() => {
    const bucket = new Map<string, number>();
    for (const event of data.recentEvents) {
      const dt = new Date(event.createdAt);
      const key = Number.isNaN(dt.getTime()) ? "00:00" : `${String(dt.getHours()).padStart(2, "0")}:00`;
      bucket.set(key, (bucket.get(key) ?? 0) + 1);
    }
    return Array.from(bucket.entries())
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .slice(-8)
      .map(([time, count]) => ({ time, count }));
  }, [data.recentEvents]);

  const eventTrendPoints = useMemo(
    () => buildSparklinePoints(eventTrend.map((item) => item.count)),
    [eventTrend],
  );

  const loadShareRows = useMemo(() => {
    const total = Math.max(1, stationStats.reduce((sum, station) => sum + Math.max(0, station.loadPercent), 0));
    return [...stationStats]
      .sort((a, b) => b.loadPercent - a.loadPercent)
      .slice(0, 6)
      .map((station) => ({
        stationLabel: station.stationLabel,
        loadPercent: station.loadPercent,
        sharePercent: Math.round((Math.max(0, station.loadPercent) / total) * 100),
      }));
  }, [stationStats]);

  useEffect(() => {
    if (!selectedOrder && orderRows[0]) {
      setSelectedOrderId(orderRows[0].order.id);
    }
  }, [orderRows, selectedOrder]);

  return (
    <section className="space-y-4 rounded-2xl border border-[var(--enver-border)] bg-[var(--enver-card)] p-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-[var(--enver-text)]">Командний центр виробництва</h1>
          <p className="text-xs text-[var(--enver-text-muted)]">
            Синхронізовано {formatRelative(data.syncedAt, nowMs)} · Автооновлення раз на 60с
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          className="rounded-lg border border-[var(--enver-border)] bg-[var(--enver-surface)] px-3 py-1.5 text-xs text-[var(--enver-text)]"
        >
          {fetching ? "Оновлення..." : "Оновити"}
        </button>
      </header>

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-[var(--enver-border)] bg-[var(--enver-surface)] p-3">
          <div className="text-[11px] text-[var(--enver-text-muted)]">Активна черга</div>
          <div className="mt-1 text-xl font-semibold text-[var(--enver-text)]">{filteredQueue.length}</div>
        </div>
        <div className="rounded-xl border border-[var(--enver-border)] bg-[var(--enver-surface)] p-3">
          <div className="text-[11px] text-[var(--enver-text-muted)]">Прострочено</div>
          <div className="mt-1 text-xl font-semibold text-[var(--enver-text)]">{queueHealth.overdue}</div>
        </div>
        <div className="rounded-xl border border-[var(--enver-border)] bg-[var(--enver-surface)] p-3">
          <div className="text-[11px] text-[var(--enver-text-muted)]">Заблоковано</div>
          <div className="mt-1 text-xl font-semibold text-[var(--enver-text)]">{queueHealth.blocked}</div>
        </div>
        <div className="rounded-xl border border-[var(--enver-border)] bg-[var(--enver-surface)] p-3">
          <div className="text-[11px] text-[var(--enver-text-muted)]">Завантаження цехів</div>
          <div className="mt-1 text-xl font-semibold text-[var(--enver-text)]">{capacitySummary.utilization}%</div>
        </div>
      </div>

      <div className="grid gap-2 md:grid-cols-3">
        <button
          type="button"
          onClick={() => setActiveTab("overview")}
          className={cn(
            "rounded-xl border px-3 py-2 text-left",
            activeTab === "overview"
              ? "border-[var(--enver-border-strong)] bg-[var(--enver-bg-accent-soft)]"
              : "border-[var(--enver-border)] bg-[var(--enver-surface)]",
          )}
        >
          <div className="text-sm font-medium text-[var(--enver-text)]">Огляд</div>
          <div className="text-xs text-[var(--enver-text-muted)]">Ключові показники та події</div>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("queue")}
          className={cn(
            "rounded-xl border px-3 py-2 text-left",
            activeTab === "queue"
              ? "border-[var(--enver-border-strong)] bg-[var(--enver-bg-accent-soft)]"
              : "border-[var(--enver-border)] bg-[var(--enver-surface)]",
          )}
        >
          <div className="text-sm font-medium text-[var(--enver-text)]">Черга</div>
          <div className="text-xs text-[var(--enver-text-muted)]">Операційний список замовлень</div>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("workshops")}
          className={cn(
            "rounded-xl border px-3 py-2 text-left",
            activeTab === "workshops"
              ? "border-[var(--enver-border-strong)] bg-[var(--enver-bg-accent-soft)]"
              : "border-[var(--enver-border)] bg-[var(--enver-surface)]",
          )}
        >
          <div className="text-sm font-medium text-[var(--enver-text)]">Цехи</div>
          <div className="text-xs text-[var(--enver-text-muted)]">Навантаження й тиск по станціях</div>
        </button>
      </div>

      {activeTab === "overview" ? (
        <div className="grid gap-4 xl:grid-cols-12">
          <div className="space-y-3 xl:col-span-7">
            <div className="rounded-xl border border-[var(--enver-border)] bg-[var(--enver-surface)] p-3">
              <div className="text-xs text-[var(--enver-text-muted)]">Операційний стан</div>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <div className="rounded-lg bg-[var(--enver-card)] p-2.5 text-sm text-[var(--enver-text)]">
                  Готові до старту: <b>{queueHealth.readyToStart}</b>
                </div>
                <div className="rounded-lg bg-[var(--enver-card)] p-2.5 text-sm text-[var(--enver-text)]">
                  Під ризиком: <b>{queueHealth.atRisk}</b>
                </div>
                <div className="rounded-lg bg-[var(--enver-card)] p-2.5 text-sm text-[var(--enver-text)]">
                  Індекс здоров&apos;я: <b>{queueHealth.healthScore}/100</b>
                </div>
                <div className="rounded-lg bg-[var(--enver-card)] p-2.5 text-sm text-[var(--enver-text)]">
                  Вузьке місце: <b>{data.workshopBottleneck?.stageLabel ?? "Немає"}</b>
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-[var(--enver-border)] bg-[var(--enver-surface)] p-3">
              <div className="mb-2 text-xs text-[var(--enver-text-muted)]">Останні події</div>
              <div className="mb-3 rounded-lg border border-[var(--enver-border)] bg-[var(--enver-card)] p-2">
                <div className="mb-1 text-[11px] text-[var(--enver-text-muted)]">Міні-тренд подій за годинами</div>
                {eventTrend.length > 1 ? (
                  <svg viewBox="0 0 240 56" className="h-14 w-full">
                    <polyline
                      fill="none"
                      stroke="rgb(56 189 248)"
                      strokeWidth="2"
                      strokeLinejoin="round"
                      strokeLinecap="round"
                      points={eventTrendPoints}
                    />
                  </svg>
                ) : (
                  <div className="text-xs text-[var(--enver-text-muted)]">Недостатньо подій для тренду.</div>
                )}
                {eventTrend.length > 0 ? (
                  <div className="mt-1 flex flex-wrap gap-2 text-[10px] text-[var(--enver-text-muted)]">
                    {eventTrend.map((item) => (
                      <span key={item.time}>
                        {item.time}: {item.count}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
              <div className="space-y-1.5">
                {data.recentEvents.slice(0, 8).map((event) => (
                  <div key={event.id} className="rounded-lg bg-[var(--enver-card)] px-2.5 py-2 text-sm">
                    <div className="text-[var(--enver-text)]">{event.flowNumber} · {event.title}</div>
                    <div className="text-xs text-[var(--enver-text-muted)]">{event.actorName} · {formatRelative(event.createdAt, nowMs)}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <aside className="space-y-3 xl:col-span-5">
            <div className="rounded-xl border border-[var(--enver-border)] bg-[var(--enver-surface)] p-3">
              <div className="mb-2 text-xs text-[var(--enver-text-muted)]">Розподіл навантаження цехів</div>
              <div className="space-y-2">
                {loadShareRows.map((item) => (
                  <div key={item.stationLabel}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="text-[var(--enver-text)]">{item.stationLabel}</span>
                      <span className="text-[var(--enver-text-muted)]">
                        {item.loadPercent}% · {item.sharePercent}%
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--enver-card)]">
                      <div
                        className={cn("h-full rounded-full", loadTone(item.loadPercent))}
                        style={{ width: `${Math.min(100, item.sharePercent)}%` }}
                      />
                    </div>
                  </div>
                ))}
                {loadShareRows.length === 0 ? (
                  <p className="text-sm text-[var(--enver-text-muted)]">Дані по цехах відсутні.</p>
                ) : null}
              </div>
            </div>
            <div className="rounded-xl border border-[var(--enver-border)] bg-[var(--enver-surface)] p-3">
              <div className="text-xs text-[var(--enver-text-muted)]">Критичні блокери</div>
              <div className="mt-2 space-y-1.5">
                {data.criticalBlockers.slice(0, 6).map((item) => (
                  <div key={`${item.flowId}-${item.message}`} className="rounded-lg bg-[var(--enver-card)] px-2.5 py-2 text-sm text-[var(--enver-text)]">
                    {item.number}: {item.message}
                  </div>
                ))}
                {data.criticalBlockers.length === 0 ? (
                  <p className="text-sm text-[var(--enver-text-muted)]">Критичних блокерів не знайдено.</p>
                ) : null}
              </div>
            </div>
          </aside>
        </div>
      ) : null}

      {activeTab === "queue" ? (
      <div className="grid gap-4 xl:grid-cols-12">
        <div className="space-y-3 xl:col-span-8">
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="search"
              value={query}
              placeholder="Пошук: номер, клієнт, виріб"
              onChange={(e) => setQuery(e.target.value)}
              className="min-w-[220px] flex-1 rounded-lg border border-[var(--enver-border)] bg-[var(--enver-surface)] px-3 py-2 text-sm text-[var(--enver-text)] outline-none"
            />
            {quickFilters.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setFilter(item.id)}
                className={cn(
                  "rounded-lg border px-2.5 py-1.5 text-xs",
                  filter === item.id
                    ? "border-[var(--enver-border-strong)] bg-[var(--enver-bg-accent)] text-[var(--enver-text)]"
                    : "border-[var(--enver-border)] bg-[var(--enver-surface)] text-[var(--enver-text-muted)]",
                )}
              >
                {item.label} ({item.count})
              </button>
            ))}
          </div>

          <div className="overflow-hidden rounded-xl border border-[var(--enver-border)]">
            <div className="grid grid-cols-12 bg-[var(--enver-surface)] px-3 py-2 text-[11px] text-[var(--enver-text-muted)]">
              <div className="col-span-2">№</div>
              <div className="col-span-3">Клієнт / Виріб</div>
              <div className="col-span-2">Стан</div>
              <div className="col-span-2">Готовність</div>
              <div className="col-span-2">Дедлайн</div>
              <div className="col-span-1 text-right">Черга</div>
            </div>
            <div className="max-h-[420px] overflow-auto">
              {orderRows.map((row) => (
                <button
                  key={row.order.id}
                  type="button"
                  onClick={() => setSelectedOrderId(row.order.id)}
                  className={cn(
                    "grid w-full grid-cols-12 border-t border-[var(--enver-border)] px-3 py-2.5 text-left text-sm",
                    selectedOrder?.order.id === row.order.id
                      ? "bg-[var(--enver-bg-accent-soft)]"
                      : "bg-[var(--enver-card)] hover:bg-[var(--enver-surface)]",
                  )}
                >
                  <div className="col-span-2 font-medium text-[var(--enver-text)]">{row.order.number}</div>
                  <div className="col-span-3">
                    <div className="text-[var(--enver-text)]">{row.order.clientName}</div>
                    <div className="text-xs text-[var(--enver-text-muted)]">{row.order.title}</div>
                  </div>
                  <div className="col-span-2 text-[var(--enver-text)]">{row.operationalState.label}</div>
                  <div className="col-span-2 text-[var(--enver-text)]">{row.order.readinessPercent}%</div>
                  <div className="col-span-2 text-[var(--enver-text)]">{dueLabel(row.order.dueDate, nowMs)}</div>
                  <div className="col-span-1 text-right text-[var(--enver-text)]">#{row.position}</div>
                </button>
              ))}
              {orderRows.length === 0 ? (
                <div className="border-t border-[var(--enver-border)] px-3 py-6 text-center text-sm text-[var(--enver-text-muted)]">
                  За фільтром немає замовлень.
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <aside className="space-y-3 xl:col-span-4">
          <div className="rounded-xl border border-[var(--enver-border)] bg-[var(--enver-surface)] p-3">
            <div className="text-xs text-[var(--enver-text-muted)]">Вибране замовлення</div>
            {selectedOrder ? (
              <div className="mt-2 space-y-1.5 text-sm text-[var(--enver-text)]">
                <div className="font-semibold">{selectedOrder.order.number}</div>
                <div>{selectedOrder.order.clientName}</div>
                <div className="text-[var(--enver-text-muted)]">{selectedOrder.order.title}</div>
                <div>Цех: {selectedOrder.workshopAssignment}</div>
                <div>Готовність: {selectedOrder.order.readinessPercent}%</div>
                <div>Дедлайн: {dueLabel(selectedOrder.order.dueDate, nowMs)}</div>
              </div>
            ) : (
              <p className="mt-2 text-sm text-[var(--enver-text-muted)]">Оберіть замовлення зі списку.</p>
            )}
          </div>

          <div className="rounded-xl border border-[var(--enver-border)] bg-[var(--enver-surface)] p-3">
            <div className="text-xs text-[var(--enver-text-muted)]">Критичні сигнали</div>
            {selectedOrderBlockers.length > 0 ? (
              <ul className="mt-2 space-y-1 text-sm text-[var(--enver-text)]">
                {selectedOrderBlockers.map((blocker) => (
                  <li key={`${blocker.flowId}-${blocker.message}`} className="rounded-md bg-[var(--enver-card)] px-2 py-1.5">
                    {blocker.message}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-[var(--enver-text-muted)]">Критичних блокерів немає.</p>
            )}
          </div>

          <div className="rounded-xl border border-[var(--enver-border)] bg-[var(--enver-surface)] p-3">
            <div className="text-xs text-[var(--enver-text-muted)]">Наступні дії</div>
            {selectedOrderActions.length > 0 ? (
              <ul className="mt-2 space-y-1 text-sm text-[var(--enver-text)]">
                {selectedOrderActions.slice(0, 4).map((action) => (
                  <li key={`${action.flowId}-${action.description}`} className="rounded-md bg-[var(--enver-card)] px-2 py-1.5">
                    {action.description}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-[var(--enver-text-muted)]">Немає рекомендацій для цього замовлення.</p>
            )}
          </div>
        </aside>
      </div>
      ) : null}

      {activeTab === "workshops" ? (
      <div className="rounded-xl border border-[var(--enver-border)] bg-[var(--enver-surface)] p-3">
        <div className="mb-2 text-xs text-[var(--enver-text-muted)]">Цехи</div>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {stationStats.map((station) => (
            <div key={station.stationKey} className="rounded-lg border border-[var(--enver-border)] bg-[var(--enver-card)] p-2.5 text-sm">
              <div className="font-medium text-[var(--enver-text)]">{station.stationLabel}</div>
              <div className="mt-1 text-[var(--enver-text-muted)]">Завантаження: {station.loadPercent}%</div>
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-[var(--enver-surface)]">
                <div className={cn("h-full rounded-full", loadTone(station.loadPercent))} style={{ width: `${Math.min(100, station.loadPercent)}%` }} />
              </div>
              <div className="text-[var(--enver-text-muted)]">У черзі: {station.inQueue}</div>
              <div className="text-[var(--enver-text-muted)]">Прострочено: {station.overdue}</div>
            </div>
          ))}
        </div>
      </div>
      ) : null}
    </section>
  );
}
