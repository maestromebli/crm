"use client";

import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Factory,
  Layers3,
  Radar,
  Sparkles,
  Triangle,
  Zap,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ProductionCommandCenterEvent, ProductionCommandCenterView } from "../../types/production";
import { buildOrderViewModels } from "./models";
import {
  getCapacitySummary,
  getDeadlineRiskState,
  getPlanningInsights,
  getPlanningPriorityReason,
  getPlanningQuickFilters,
  getQueueHealthSummary,
  getReplanImpact,
  getWorkshopLoadState,
} from "./planning-selectors";

const POLL_MS = 45_000;

type Tone = "cyan" | "violet" | "amber" | "red";

function formatRelative(iso: string, nowMs: number): string {
  const t = new Date(iso).getTime();
  const seconds = Math.max(0, Math.floor((nowMs - t) / 1000));
  if (seconds < 60) return `${seconds}с тому`;
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}хв тому`;
  return `${Math.floor(mins / 60)}г тому`;
}

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function toneClass(tone: Tone) {
  switch (tone) {
    case "cyan":
      return "from-cyan-400/35 to-sky-500/5 border-cyan-300/25";
    case "violet":
      return "from-violet-400/35 to-fuchsia-500/5 border-violet-300/25";
    case "amber":
      return "from-amber-400/35 to-orange-500/5 border-amber-300/25";
    case "red":
      return "from-red-400/35 to-rose-500/5 border-red-300/25";
    default:
      return "from-white/10 to-white/5 border-white/10";
  }
}

function riskLabelByDays(days: number | null): string {
  if (days === null) return "Без дедлайну";
  if (days < 0) return `${Math.abs(days)}дн прострочено`;
  if (days === 0) return "Термін сьогодні";
  return `Залишилося ${days}дн`;
}

function getDueInDays(iso: string | null): number | null {
  if (!iso) return null;
  const dueTime = new Date(iso).getTime();
  if (Number.isNaN(dueTime)) return null;
  return Math.ceil((dueTime - Date.now()) / (24 * 60 * 60 * 1000));
}

function getOperationalStyle(key: string) {
  switch (key) {
    case "ready_to_start":
      return {
        label: "ГОТОВО",
        ring: "bg-emerald-400 shadow-[0_0_20px_rgba(52,211,153,0.45)]",
        text: "text-emerald-300",
        border: "border-emerald-400/20",
        stripe: "from-emerald-400 to-cyan-400",
      };
    case "in_production":
      return {
        label: "У ВИРОБНИЦТВІ",
        ring: "bg-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.45)]",
        text: "text-cyan-300",
        border: "border-cyan-400/20",
        stripe: "from-cyan-400 to-sky-400",
      };
    case "blocked":
      return {
        label: "ЗАБЛОКОВАНО",
        ring: "bg-red-400 shadow-[0_0_20px_rgba(248,113,113,0.45)]",
        text: "text-red-300",
        border: "border-red-400/20",
        stripe: "from-red-400 to-rose-400",
      };
    case "at_risk":
      return {
        label: "ПІД РИЗИКОМ",
        ring: "bg-amber-400 shadow-[0_0_20px_rgba(251,191,36,0.45)]",
        text: "text-amber-300",
        border: "border-amber-400/20",
        stripe: "from-amber-400 to-orange-400",
      };
    case "overdue":
      return {
        label: "ПРОСТРОЧЕНО",
        ring: "bg-rose-400 shadow-[0_0_24px_rgba(244,63,94,0.55)]",
        text: "text-rose-300",
        border: "border-rose-400/20",
        stripe: "from-rose-400 to-red-500",
      };
    case "waiting_dependency":
      return {
        label: "ОЧІКУЄ",
        ring: "bg-yellow-300 shadow-[0_0_18px_rgba(253,224,71,0.35)]",
        text: "text-yellow-200",
        border: "border-yellow-300/20",
        stripe: "from-yellow-300 to-amber-400",
      };
    default:
      return {
        label: "У ЧЕРЗІ",
        ring: "bg-slate-300 shadow-[0_0_18px_rgba(203,213,225,0.2)]",
        text: "text-slate-300",
        border: "border-slate-400/20",
        stripe: "from-slate-400 to-slate-500",
      };
  }
}

function buildThroughputSeries(events: ProductionCommandCenterEvent[]) {
  const byHour = new Map<string, number>();
  for (const event of events) {
    const d = new Date(event.createdAt);
    const hour = Number.isNaN(d.getTime()) ? "00:00" : `${String(d.getHours()).padStart(2, "0")}:00`;
    byHour.set(hour, (byHour.get(hour) ?? 0) + 1);
  }
  const rows = Array.from(byHour.entries())
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .slice(-8)
    .map(([time, count]) => ({ time, count }));
  let cumulative = 0;
  return rows.map((row) => {
    cumulative += row.count;
    return { time: row.time, value: cumulative };
  });
}

function Panel({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[28px] border border-white/10 bg-white/5 backdrop-blur-xl",
        "shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_20px_80px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.06)]",
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.12),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(139,92,246,0.12),transparent_35%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/60 to-transparent" />
      <div className="relative z-10">{children}</div>
    </div>
  );
}

function BackgroundFX({ reduceMotion }: { reduceMotion: boolean }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(34,211,238,0.16),transparent_25%),radial-gradient(circle_at_80%_20%,rgba(139,92,246,0.16),transparent_30%),radial-gradient(circle_at_50%_80%,rgba(59,130,246,0.10),transparent_35%)]" />
      <div className="absolute inset-0 opacity-[0.12] [background-image:linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:48px_48px]" />
      {!reduceMotion ? (
        <>
          <motion.div
            className="absolute -left-40 top-0 h-[420px] w-[420px] rounded-full bg-cyan-400/10 blur-[120px]"
            animate={{ x: [0, 40, 0], y: [0, 30, 0] }}
            transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute right-0 top-20 h-[380px] w-[380px] rounded-full bg-violet-500/10 blur-[120px]"
            animate={{ x: [0, -40, 0], y: [0, -25, 0] }}
            transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute left-1/3 top-0 h-px w-72 bg-gradient-to-r from-transparent via-cyan-300/60 to-transparent"
            animate={{ x: ["-10%", "110%"] }}
            transition={{ duration: 4.5, repeat: Infinity, ease: "linear" }}
          />
        </>
      ) : null}
    </div>
  );
}

function HeroMetricCard({
  label,
  value,
  sub,
  tone,
  spark,
}: {
  label: string;
  value: string;
  sub: string;
  tone: Tone;
  spark: number[];
}) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      whileHover={reduceMotion ? undefined : { y: -4, scale: 1.01, rotateX: 2 }}
      transition={{ duration: 0.25 }}
      className={cn(
        "group relative overflow-hidden rounded-[24px] border bg-gradient-to-br p-4",
        "from-white/10 to-white/[0.03]",
        toneClass(tone),
        "shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_12px_40px_rgba(0,0,0,0.35)]",
      )}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.12),transparent_35%)] opacity-70" />
      <div className="relative z-10">
        <div className="flex items-center justify-between">
          <span className="text-[11px] uppercase tracking-[0.24em] text-white/55">{label}</span>
          <Sparkles className="h-4 w-4 text-white/35" />
        </div>
        <div className="mt-3 flex items-end justify-between gap-4">
          <div>
            <div className="text-3xl font-semibold tracking-tight text-white">{value}</div>
            <div className="mt-1 text-xs text-white/55">{sub}</div>
          </div>
          <div className="h-12 w-24">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={spark.map((v, i) => ({ i, v }))}>
                <Line type="monotone" dataKey="v" stroke="rgba(103,232,249,0.9)" strokeWidth={2.2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function RadialGauge({
  title,
  value,
  suffix = "%",
  color,
}: {
  title: string;
  value: number;
  suffix?: string;
  color: string;
}) {
  const reduceMotion = useReducedMotion();
  const data = [{ name: title, value, fill: color }];
  return (
    <Panel className="p-4">
      <div className="mb-2 text-[11px] uppercase tracking-[0.24em] text-white/55">{title}</div>
      <div className="relative h-56">
        <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.08),transparent_60%)] blur-2xl" />
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart data={data} innerRadius="62%" outerRadius="88%" startAngle={210} endAngle={-30} barSize={18}>
            <PolarGrid radialLines={false} stroke="rgba(255,255,255,0.08)" />
            <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
            <PolarRadiusAxis tick={false} axisLine={false} />
            <RadialBar background={{ fill: "rgba(255,255,255,0.06)" }} dataKey="value" cornerRadius={999} />
          </RadialBarChart>
        </ResponsiveContainer>
        {!reduceMotion ? (
          <motion.div
            className="pointer-events-none absolute inset-8 rounded-full border border-white/10"
            animate={{ rotate: 360 }}
            transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
          />
        ) : null}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="absolute h-28 w-28 rounded-full blur-2xl" style={{ background: color, opacity: 0.18 }} />
          <div className="relative z-10 text-center">
            <div className="text-4xl font-semibold text-white">
              {value}
              <span className="text-lg text-white/55">{suffix}</span>
            </div>
            <div className="mt-1 text-xs uppercase tracking-[0.24em] text-white/45">Наживо</div>
          </div>
        </div>
      </div>
    </Panel>
  );
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <Panel className="p-5">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <div className="text-sm font-medium text-white">{title}</div>
          <div className="mt-1 text-xs text-white/45">{subtitle}</div>
        </div>
        <div className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.24em] text-cyan-200">
          Наживо
        </div>
      </div>
      <div className="h-72">{children}</div>
    </Panel>
  );
}

export function ProductionCommandCenter({ data: initial }: { data: ProductionCommandCenterView }) {
  const reduceMotion = useReducedMotion();
  const [data, setData] = useState(initial);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(initial.queue[0]?.id ?? null);
  const [targetSlot, setTargetSlot] = useState(1);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [fetching, setFetching] = useState(false);

  const refresh = useCallback(async () => {
    if (document.visibilityState !== "visible") return;
    setFetching(true);
    try {
      const res = await fetch("/api/crm/production/command-center", { credentials: "include", cache: "no-store" });
      if (!res.ok) return;
      setData((await res.json()) as ProductionCommandCenterView);
    } finally {
      setFetching(false);
    }
  }, []);

  useEffect(() => {
    if (document.visibilityState === "visible") {
      void refresh();
    }
    const id = window.setInterval(() => {
      void refresh();
    }, POLL_MS);
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void refresh();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [refresh]);

  const quickFilters = useMemo(() => getPlanningQuickFilters(data), [data]);
  const selectedFilter = useMemo(() => quickFilters.find((item) => item.id === filter) ?? quickFilters[0], [filter, quickFilters]);

  const filteredQueue = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = data.queue.filter((row) => selectedFilter.predicate(row));
    if (!q) return rows;
    return rows.filter(
      (row) => row.number.toLowerCase().includes(q) || row.clientName.toLowerCase().includes(q) || row.title.toLowerCase().includes(q),
    );
  }, [data.queue, query, selectedFilter]);

  const filteredData = useMemo(() => ({ ...data, queue: filteredQueue }), [data, filteredQueue]);
  const capacitySummary = useMemo(() => getCapacitySummary(data), [data]);
  const queueHealth = useMemo(() => getQueueHealthSummary(filteredQueue), [filteredQueue]);
  const insights = useMemo(() => getPlanningInsights(filteredData), [filteredData]);
  const orderRows = useMemo(() => buildOrderViewModels(filteredData), [filteredData]);
  const selectedOrder = useMemo(
    () => orderRows.find((item) => item.order.id === selectedOrderId) ?? orderRows[0] ?? null,
    [orderRows, selectedOrderId],
  );
  const replanImpact = useMemo(
    () => (selectedOrder ? getReplanImpact(selectedOrder.order, targetSlot - 1, filteredQueue) : null),
    [filteredQueue, selectedOrder, targetSlot],
  );

  const metrics = useMemo(
    () => [
      {
        label: "Загальне завантаження",
        value: `${capacitySummary.utilization}%`,
        sub: `${capacitySummary.allocatedLoad}/${Math.max(1, capacitySummary.capacity)} потужності`,
        tone: "cyan" as const,
        spark: [46, 54, 57, 63, 68, 74, capacitySummary.utilization],
      },
      {
        label: "Виконання в строк",
        value: `${Math.max(0, 100 - Math.round((queueHealth.overdue / Math.max(1, queueHealth.total)) * 100))}%`,
        sub: `${queueHealth.overdue} прострочено / ${queueHealth.total} активних`,
        tone: "violet" as const,
        spark: [68, 73, 77, 78, 81, 85, Math.max(60, 100 - queueHealth.overdue * 3)],
      },
      {
        label: "Замовлення із затримкою",
        value: String(insights.criticalOverdue).padStart(2, "0"),
        sub: `${insights.blockedOrders} заблоковано паралельно`,
        tone: insights.criticalOverdue > 0 ? ("amber" as const) : ("cyan" as const),
        spark: [2, 3, 2, 4, 5, 4, insights.criticalOverdue],
      },
      {
        label: "Активні цехи",
        value: String(data.stationLoads.length).padStart(2, "0"),
        sub: `${insights.overloadedWorkshops} біля/понад межу потужності`,
        tone: "cyan" as const,
        spark: [2, 3, 4, 4, 5, 5, data.stationLoads.length],
      },
      {
        label: "Ризик вузького місця",
        value: data.workshopBottleneck ? `${data.workshopBottleneck.sharePercent}%` : "НИЗЬКИЙ",
        sub: data.workshopBottleneck ? `Тиск етапу: ${data.workshopBottleneck.stageLabel}` : "Домінуючого етапу немає",
        tone: data.workshopBottleneck && data.workshopBottleneck.sharePercent >= 32 ? ("red" as const) : ("amber" as const),
        spark: [11, 14, 18, 22, 27, 29, data.workshopBottleneck?.sharePercent ?? 10],
      },
      {
        label: "Пропускна здатність сьогодні",
        value: String(data.recentEvents.length).padStart(2, "0"),
        sub: "подій у живому операційному журналі",
        tone: "violet" as const,
        spark: [4, 6, 7, 9, 11, 12, Math.min(18, data.recentEvents.length)],
      },
    ],
    [capacitySummary, data.recentEvents.length, data.stationLoads.length, data.workshopBottleneck, insights, queueHealth],
  );

  const capacityTrend = useMemo(() => {
    return data.workshopKanban.map((stage, idx) => {
      const station = data.stationLoads[idx % Math.max(1, data.stationLoads.length)];
      const load = station?.loadPercent ?? Math.min(98, stage.tasks.length * 7);
      const target = Math.min(95, Math.max(55, Math.round((capacitySummary.utilization + 72) / 2)));
      const pressure = Math.min(100, Math.round((stage.tasks.length / Math.max(1, data.queue.length)) * 130));
      return {
        day: stage.stageLabel.slice(0, 3).toUpperCase(),
        load,
        target,
        pressure,
      };
    });
  }, [capacitySummary.utilization, data.queue.length, data.stationLoads, data.workshopKanban]);

  const throughputTrend = useMemo(() => buildThroughputSeries(data.recentEvents), [data.recentEvents]);

  const loadDistribution = useMemo(
    () =>
      [...data.stationLoads]
        .sort((a, b) => b.loadPercent - a.loadPercent)
        .slice(0, 6)
        .map((item, idx) => ({
          name: item.stationLabel,
          load: item.loadPercent,
          fill: ["#22d3ee", "#8b5cf6", "#38bdf8", "#f59e0b", "#fb7185", "#60a5fa"][idx % 6],
        })),
    [data.stationLoads],
  );

  const deadlinePressure = useMemo(() => {
    const overdue = filteredQueue.filter((item) => getDeadlineRiskState(item) === "overdue").length;
    const promiseMiss = filteredQueue.filter((item) => getDeadlineRiskState(item) === "will_miss_promise").length;
    const dueSoon = filteredQueue.filter((item) => getDeadlineRiskState(item) === "due_soon").length;
    const dueToday = filteredQueue.filter((item) => getDeadlineRiskState(item) === "due_today").length;
    const safe = Math.max(0, filteredQueue.length - overdue - promiseMiss - dueSoon - dueToday);
    return [
      { label: "Прострочено", value: overdue, fill: "#fb7185" },
      { label: "Ризик зриву", value: promiseMiss, fill: "#f59e0b" },
      { label: "Термін сьогодні", value: dueToday, fill: "#facc15" },
      { label: "Незабаром термін", value: dueSoon, fill: "#38bdf8" },
      { label: "Безпечно", value: safe, fill: "#34d399" },
    ];
  }, [filteredQueue]);

  const heatmapRows = useMemo(() => {
    return data.stationLoads.map((station) => {
      const inQueue = orderRows.filter((row) => row.workshopAssignment === station.stationLabel).length;
      const blocked = orderRows.filter(
        (row) => row.workshopAssignment === station.stationLabel && row.operationalState.key === "blocked",
      ).length;
      const overdue = orderRows.filter(
        (row) => row.workshopAssignment === station.stationLabel && row.deadlineRisk === "overdue",
      ).length;
      return {
        id: station.stationKey,
        name: station.stationLabel,
        load: station.loadPercent,
        inQueue,
        blocked,
        overdue,
        state: getWorkshopLoadState({ loadPercent: station.loadPercent }).key,
      };
    });
  }, [data.stationLoads, orderRows]);

  const alerts = useMemo(() => {
    const live = [
      `${insights.criticalOverdue} ПРОСТРОЧЕНИХ ЗАМОВЛЕНЬ`,
      `${insights.blockedOrders} ЗАБЛОКОВАНИХ ПОТОКІВ`,
      `${insights.todayStarts} СТАРТІВ СЬОГОДНІ`,
      `${insights.todayFinishes} АКТИВНИХ У ВИРОБНИЦТВІ`,
      `${insights.replanCandidates} КАНДИДАТІВ НА ПЕРЕПЛАНУВАННЯ`,
      data.workshopBottleneck
        ? `ВУЗЬКЕ МІСЦЕ: ${data.workshopBottleneck.stageLabel} (${data.workshopBottleneck.taskCount})`
        : "ДОМІНУЮЧОГО ВУЗЬКОГО МІСЦЯ НЕМАЄ",
    ];
    const blockers = data.criticalBlockers.slice(0, 3).map((b) => `${b.number} · ${b.message}`);
    return [...live, ...blockers];
  }, [data.criticalBlockers, data.workshopBottleneck, insights]);

  const selectedOrderBlockers = useMemo(
    () => data.criticalBlockers.filter((item) => item.flowId === selectedOrder?.order.id),
    [data.criticalBlockers, selectedOrder],
  );
  const selectedOrderActions = useMemo(
    () => data.nextActions.filter((item) => item.flowId === selectedOrder?.order.id),
    [data.nextActions, selectedOrder],
  );

  useEffect(() => {
    if (!selectedOrder && orderRows[0]) {
      setSelectedOrderId(orderRows[0].order.id);
      setTargetSlot(orderRows[0].position);
    }
  }, [orderRows, selectedOrder]);

  return (
    <div className="relative overflow-hidden rounded-[32px] bg-[#060b16] p-3 text-white md:p-4">
      <BackgroundFX reduceMotion={reduceMotion} />
      <div className="relative z-10 space-y-4">
        <Panel className="p-5 md:p-6">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/10 p-2">
                <Factory className="h-5 w-5 text-cyan-200" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Командний центр виробництва</h1>
                <p className="mt-1 text-sm text-white/50">
                  Живі виробничі операції, тиск черги, ризики вузьких місць та аналітика перепланування
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs uppercase tracking-[0.24em] text-white/65">
                Синхронізовано {formatRelative(data.syncedAt, Date.now())}
              </div>
              <div className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs uppercase tracking-[0.24em] text-white/65">
                Усі цехи
              </div>
              <div className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs uppercase tracking-[0.24em] text-white/65">
                Сьогодні + наступні 3 дні
              </div>
              <button
                type="button"
                onClick={() => void refresh()}
                className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-4 py-2 text-xs uppercase tracking-[0.24em] text-cyan-100 transition hover:bg-cyan-300/15"
              >
                {fetching ? "Оновлення..." : "Оновити зараз"}
              </button>
            </div>
          </div>
        </Panel>

        <Panel className="overflow-hidden py-3">
          <motion.div
            className="flex gap-8 px-6"
            animate={reduceMotion ? undefined : { x: ["0%", "-50%"] }}
            transition={
              reduceMotion ? undefined : { duration: 20, repeat: Infinity, ease: "linear" }
            }
          >
            {(reduceMotion ? alerts : [...alerts, ...alerts]).map((item, idx) => (
              <div key={`${item}-${idx}`} className="flex shrink-0 items-center gap-3">
                <AlertTriangle className="h-4 w-4 text-amber-300" />
                <span className="text-xs uppercase tracking-[0.24em] text-white/75">{item}</span>
              </div>
            ))}
          </motion.div>
        </Panel>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          {metrics.map((metric) => (
            <HeroMetricCard key={metric.label} {...metric} />
          ))}
        </div>

        <div className="grid gap-4 xl:grid-cols-12">
          <div className="grid gap-4 md:grid-cols-2 xl:col-span-4">
            <RadialGauge title="Завантаження цехів" value={capacitySummary.utilization} color="#22d3ee" />
            <RadialGauge
              title="Ризик дедлайнів"
              value={Math.min(100, Math.round((queueHealth.overdue + queueHealth.atRisk) * 10))}
              color="#f59e0b"
            />
            <RadialGauge
              title="Готово до старту"
              value={Math.min(100, Math.round((queueHealth.readyToStart / Math.max(1, queueHealth.total)) * 100))}
              color="#8b5cf6"
            />
            <RadialGauge title="Індекс ефективності" value={queueHealth.healthScore} color="#38bdf8" />
          </div>

          <div className="space-y-4 xl:col-span-8">
            <div className="grid gap-4 md:grid-cols-2">
              <ChartCard title="Тренд потужності" subtitle="Завантаження етапів, тиск і цільовий коридор">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={capacityTrend}>
                    <defs>
                      <linearGradient id="capLoad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.85} />
                        <stop offset="100%" stopColor="#22d3ee" stopOpacity={0.05} />
                      </linearGradient>
                      <linearGradient id="capPressure" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.55} />
                        <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.03} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                    <XAxis dataKey="day" stroke="rgba(255,255,255,0.35)" tickLine={false} axisLine={false} />
                    <YAxis stroke="rgba(255,255,255,0.35)" tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={{
                        background: "rgba(8,12,22,0.95)",
                        border: "1px solid rgba(255,255,255,0.08)",
                        borderRadius: 16,
                        color: "#fff",
                      }}
                    />
                    <Area type="monotone" dataKey="pressure" stroke="#8b5cf6" strokeWidth={2} fill="url(#capPressure)" />
                    <Area type="monotone" dataKey="load" stroke="#22d3ee" strokeWidth={3} fill="url(#capLoad)" />
                    <Line type="monotone" dataKey="target" stroke="rgba(255,255,255,0.45)" strokeDasharray="4 4" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard title="Таймлайн пропускної здатності" subtitle="Накопичені події команд по годинах роботи">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={throughputTrend}>
                    <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                    <XAxis dataKey="time" stroke="rgba(255,255,255,0.35)" tickLine={false} axisLine={false} />
                    <YAxis stroke="rgba(255,255,255,0.35)" tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={{
                        background: "rgba(8,12,22,0.95)",
                        border: "1px solid rgba(255,255,255,0.08)",
                        borderRadius: 16,
                        color: "#fff",
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke="#67e8f9"
                      strokeWidth={3.5}
                      dot={{ r: 4, fill: "#67e8f9", stroke: "#0f172a", strokeWidth: 2 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <ChartCard title="Розподіл навантаження" subtitle="Тиск розподілу між цехами">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={loadDistribution} layout="vertical">
                    <CartesianGrid stroke="rgba(255,255,255,0.06)" horizontal={false} />
                    <XAxis type="number" stroke="rgba(255,255,255,0.35)" tickLine={false} axisLine={false} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      stroke="rgba(255,255,255,0.45)"
                      tickLine={false}
                      axisLine={false}
                      width={100}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "rgba(8,12,22,0.95)",
                        border: "1px solid rgba(255,255,255,0.08)",
                        borderRadius: 16,
                        color: "#fff",
                      }}
                    />
                    <Bar dataKey="load" radius={[999, 999, 999, 999]}>
                      {loadDistribution.map((entry) => (
                        <Cell key={entry.name} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard title="Тиск дедлайнів" subtitle="Розподіл ризиків в активній тактичній черзі">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={deadlinePressure}>
                    <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                    <XAxis dataKey="label" stroke="rgba(255,255,255,0.35)" tickLine={false} axisLine={false} />
                    <YAxis stroke="rgba(255,255,255,0.35)" tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={{
                        background: "rgba(8,12,22,0.95)",
                        border: "1px solid rgba(255,255,255,0.08)",
                        borderRadius: 16,
                        color: "#fff",
                      }}
                    />
                    <Bar dataKey="value" radius={[14, 14, 2, 2]}>
                      {deadlinePressure.map((entry) => (
                        <Cell key={entry.label} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-12">
          <div className="xl:col-span-8">
            <Panel className="p-5">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-medium text-white">Тактичний потік замовлень</div>
                  <div className="mt-1 text-xs text-white/45">
                    Операційний список з готовністю, ризиком дедлайнів, пріоритетом черги та призначенням цеху
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs uppercase tracking-[0.24em] text-white/45">
                  <Clock3 className="h-4 w-4" />
                  Жива черга
                </div>
              </div>

              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <input
                  type="search"
                  value={query}
                  placeholder="Пошук: замовлення / клієнт / виріб"
                  onChange={(e) => setQuery(e.target.value)}
                  className="min-w-[240px] rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white outline-none placeholder:text-white/35 focus:border-cyan-300/30"
                />
                <div className="flex flex-wrap gap-2">
                  {quickFilters.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setFilter(item.id)}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-xs uppercase tracking-[0.2em] transition",
                        filter === item.id
                          ? "border-cyan-300/20 bg-cyan-300/12 text-cyan-100"
                          : "border-white/10 bg-white/[0.03] text-white/65 hover:bg-white/[0.06]",
                      )}
                    >
                      {item.label} ({item.count})
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                {orderRows.map((row) => {
                  const style = getOperationalStyle(row.operationalState.key);
                  const dueDays = getDueInDays(row.order.dueDate);
                  return (
                    <motion.button
                      key={row.order.id}
                      whileHover={reduceMotion ? undefined : { y: -2, scale: 1.004 }}
                      type="button"
                      onClick={() => {
                        setSelectedOrderId(row.order.id);
                        setTargetSlot(row.position);
                      }}
                      className={cn(
                        "group relative w-full overflow-hidden rounded-[22px] border bg-white/[0.04] p-4 text-left transition",
                        style.border,
                        selectedOrder?.order.id === row.order.id
                          ? "shadow-[0_0_0_1px_rgba(34,211,238,0.24),0_16px_40px_rgba(0,0,0,0.4),0_0_30px_rgba(34,211,238,0.12)]"
                          : "shadow-[0_12px_30px_rgba(0,0,0,0.28)]",
                      )}
                    >
                      <div className={cn("absolute inset-y-0 left-0 w-1 bg-gradient-to-b", style.stripe)} />
                      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.08),transparent_25%)]" />
                      <div className="relative z-10 grid grid-cols-12 gap-3">
                        <div className="col-span-12 md:col-span-3">
                          <div className="flex items-center gap-3">
                            <div className={cn("h-2.5 w-2.5 rounded-full", style.ring)} />
                            <div className="text-sm font-semibold text-white">{row.order.number}</div>
                          </div>
                          <div className="mt-1 text-xs text-white/45">{row.order.clientName}</div>
                          <div className="text-sm text-white/80">{row.order.title}</div>
                        </div>
                        <div className="col-span-6 md:col-span-2">
                          <div className="text-[10px] uppercase tracking-[0.24em] text-white/40">Стан</div>
                          <div className={cn("mt-2 text-xs font-medium", style.text)}>{style.label}</div>
                        </div>
                        <div className="col-span-6 md:col-span-2">
                          <div className="text-[10px] uppercase tracking-[0.24em] text-white/40">Готовність</div>
                          <div className="mt-2 flex items-center gap-2">
                            <div className="text-sm font-semibold text-white">{row.order.readinessPercent}%</div>
                            <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/8">
                              <div
                                className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-violet-400"
                                style={{ width: `${row.order.readinessPercent}%` }}
                              />
                            </div>
                          </div>
                        </div>
                        <div className="col-span-6 md:col-span-2">
                          <div className="text-[10px] uppercase tracking-[0.24em] text-white/40">Дедлайн</div>
                          <div className="mt-2 text-sm font-medium text-white">{riskLabelByDays(dueDays)}</div>
                        </div>
                        <div className="col-span-6 md:col-span-1">
                          <div className="text-[10px] uppercase tracking-[0.24em] text-white/40">Черга</div>
                          <div className="mt-2 text-sm font-semibold text-white">#{row.position}</div>
                        </div>
                        <div className="col-span-12 md:col-span-2">
                          <div className="text-[10px] uppercase tracking-[0.24em] text-white/40">Цех</div>
                          <div className="mt-2 text-sm text-white">{row.workshopAssignment}</div>
                          <div className="text-xs text-white/45">{row.priorityReason.label}</div>
                        </div>
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            </Panel>
          </div>

          <div className="space-y-4 xl:col-span-4">
            <Panel className="p-5">
              <div className="mb-4 flex items-start justify-between">
                <div>
                  <div className="text-sm font-medium text-white">Консоль аналізу задачі</div>
                  <div className="mt-1 text-xs text-white/45">Критичний шлях вибраного замовлення та вплив перепланування</div>
                </div>
                <div className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] uppercase tracking-[0.24em] text-cyan-200">
                  {selectedOrder?.operationalState.label ?? "Нічого не вибрано"}
                </div>
              </div>

              {selectedOrder ? (
                <div className="space-y-4">
                  <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4">
                    <div className="text-lg font-semibold text-white">{selectedOrder.order.number}</div>
                    <div className="mt-1 text-sm text-white/60">
                      {selectedOrder.order.clientName} · {selectedOrder.order.title}
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <div className="text-[10px] uppercase tracking-[0.24em] text-white/35">Позиція в черзі</div>
                        <div className="mt-1 text-white">#{selectedOrder.position}</div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase tracking-[0.24em] text-white/35">Цех</div>
                        <div className="mt-1 text-white">{selectedOrder.workshopAssignment}</div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase tracking-[0.24em] text-white/35">Готовність</div>
                        <div className="mt-1 text-white">{selectedOrder.order.readinessPercent}%</div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase tracking-[0.24em] text-white/35">Дедлайн</div>
                        <div className="mt-1 text-white">{riskLabelByDays(getDueInDays(selectedOrder.order.dueDate))}</div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4">
                    <div className="mb-3 flex items-center gap-2">
                      <Layers3 className="h-4 w-4 text-cyan-300" />
                      <div className="text-sm font-medium text-white">Критичний шлях</div>
                    </div>
                    <div className="space-y-3">
                      {[
                        "Технічний пакет перевірено",
                        "Розподіл матеріалів підтверджено",
                        "Слот цеху зафіксовано",
                        "Фінальний запуск погоджено",
                      ].map((step, i) => (
                        <div key={step} className="flex items-center gap-3">
                          <div
                            className={cn(
                              "h-2.5 w-2.5 rounded-full",
                              i === 0 && selectedOrder.order.blockersCount > 0
                                ? "bg-rose-400 shadow-[0_0_16px_rgba(244,63,94,0.45)]"
                                : "bg-cyan-300 shadow-[0_0_16px_rgba(34,211,238,0.35)]",
                            )}
                          />
                          <div className="text-sm text-white/75">{step}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4">
                    <div className="mb-3 flex items-center gap-2">
                      <Triangle className="h-4 w-4 text-amber-300" />
                      <div className="text-sm font-medium text-white">Симуляція впливу</div>
                    </div>
                    <div className="space-y-3 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-white/55">Причина пріоритету</span>
                        <span className="text-white">{getPlanningPriorityReason(selectedOrder.order).label}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-white/55">Вплив на цех</span>
                        <span className="text-white">{replanImpact?.workshopImpact ?? "Впливу поки немає"}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-white/55">Конфлікти дедлайнів</span>
                        <span className="text-white">{replanImpact?.deadlineConflicts ?? 0}</span>
                      </div>
                      <div>
                        <div className="mb-2 text-white/55">Вплив на завантаження</div>
                        <div className="h-2 overflow-hidden rounded-full bg-white/8">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-violet-400 to-amber-400"
                            style={{ width: `${Math.min(100, Math.max(8, (Math.abs(replanImpact?.overloadDelta ?? 0) + 2) * 12))}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4">
                    <div className="mb-3 flex items-center gap-2">
                      <Radar className="h-4 w-4 text-rose-300" />
                      <div className="text-sm font-medium text-white">Критичні сигнали</div>
                    </div>
                    <div className="space-y-2 text-sm text-white/75">
                      {selectedOrderBlockers.length > 0 ? (
                        selectedOrderBlockers.map((blocker) => (
                          <div key={blocker.flowId + blocker.message} className="rounded-xl border border-rose-300/20 bg-rose-400/8 px-3 py-2">
                            {blocker.message}
                          </div>
                        ))
                      ) : (
                        <div className="rounded-xl border border-emerald-300/20 bg-emerald-300/10 px-3 py-2">
                          Для цього замовлення критичних блокерів не зафіксовано.
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4">
                    <div className="mb-3 flex items-center gap-2">
                      <Zap className="h-4 w-4 text-cyan-300" />
                      <div className="text-sm font-medium text-white">Наступні дії</div>
                    </div>
                    <div className="grid gap-2">
                      {(selectedOrderActions.length > 0
                        ? selectedOrderActions.map((item) => item.description)
                        : ["Перепланувати замовлення", "Підняти у пріоритетну лінію", "Відкрити виробничий пакет", "Повернути на доопрацювання"]
                      ).map((action, i) => (
                        <button
                          key={action}
                          type="button"
                          onClick={() => {
                            if (i === 0) setFilter("at-risk");
                            if (i === 1) setTargetSlot(Math.max(1, targetSlot - 1));
                            if (i === 2) setFilter("ready");
                            if (i === 3) setFilter("blocked");
                          }}
                          className={cn(
                            "flex items-center justify-between rounded-2xl border px-3 py-2.5 text-sm transition",
                            i === 0
                              ? "border-cyan-300/20 bg-cyan-300/10 text-cyan-100 hover:bg-cyan-300/15"
                              : "border-white/10 bg-white/[0.03] text-white/80 hover:bg-white/[0.05]",
                          )}
                        >
                          <span>{action}</span>
                          <ArrowRight className="h-4 w-4" />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/60">
                  Виберіть замовлення з тактичного потоку, щоб відкрити аналіз задачі.
                </div>
              )}
            </Panel>

            <Panel className="p-5">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-white">Теплова мапа вузьких місць і тиску</div>
                  <div className="mt-1 text-xs text-white/45">Перевантажені зони, заблоковані кластери та тиск черги</div>
                </div>
                <Radar className="h-5 w-5 text-cyan-300" />
              </div>
              <div className="space-y-3">
                {heatmapRows.map((w) => {
                  const intensity =
                    w.state === "overloaded"
                      ? "from-rose-500/60 via-orange-400/35 to-transparent"
                      : w.state === "near_capacity"
                        ? "from-amber-400/45 via-yellow-300/20 to-transparent"
                        : w.state === "balanced"
                          ? "from-cyan-400/35 via-sky-300/15 to-transparent"
                          : "from-sky-400/25 via-cyan-300/10 to-transparent";
                  return (
                    <div key={w.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <div>
                          <div className="text-sm font-medium text-white">{w.name}</div>
                          <div className="text-xs text-white/55">{w.state.replace("_", " ").toUpperCase()}</div>
                        </div>
                        <div className="text-right text-xs text-white/50">
                          <div>Черга {w.inQueue}</div>
                          <div>
                            O:{w.overdue} / B:{w.blocked}
                          </div>
                        </div>
                      </div>
                      <div className="relative h-3 overflow-hidden rounded-full bg-white/5">
                        <motion.div
                          className={cn("absolute inset-y-0 left-0 rounded-full bg-gradient-to-r", intensity)}
                          initial={{ width: 0 }}
                          animate={reduceMotion ? undefined : { width: `${Math.min(w.load, 100)}%` }}
                          transition={{ duration: 0.8 }}
                          style={reduceMotion ? { width: `${Math.min(w.load, 100)}%` } : undefined}
                        />
                        <div className="absolute inset-0 rounded-full ring-1 ring-inset ring-white/10" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Panel>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Panel className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-200" />
              </div>
              <div>
                <div className="text-sm font-medium text-white">Вікно готового запуску</div>
                <div className="mt-1 text-xs text-white/45">{queueHealth.readyToStart} замовлень можуть стартувати без конфліктів</div>
              </div>
            </div>
          </Panel>
          <Panel className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl border border-amber-300/20 bg-amber-300/10 p-2">
                <AlertTriangle className="h-4 w-4 text-amber-200" />
              </div>
              <div>
                <div className="text-sm font-medium text-white">Перепланувати сьогодні</div>
                <div className="mt-1 text-xs text-white/45">{insights.replanCandidates} потоків потребують втручання сьогодні</div>
              </div>
            </div>
          </Panel>
          <Panel className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/10 p-2">
                <Zap className="h-4 w-4 text-cyan-200" />
              </div>
              <div>
                <div className="text-sm font-medium text-white">Можливість використати вільну потужність</div>
                <div className="mt-1 text-xs text-white/45">{capacitySummary.nextAvailableSlot}</div>
              </div>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
