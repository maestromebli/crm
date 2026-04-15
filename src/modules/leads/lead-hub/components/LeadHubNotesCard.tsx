"use client";

import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
} from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  BadgeCheck,
  Bell,
  Calendar,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Filter,
  Flame,
  Layers3,
  Search,
  Sparkles,
  TrendingUp,
  User,
  X,
} from "lucide-react";
import {
  enforceCacheSize,
  mapWithConcurrency,
  pruneExpiredCache,
  readFreshCache,
  retryAsync,
  trimHubRailIds,
  writeCache,
  type CacheEntry,
} from "./leadHubFetch.utils";

type Props = {
  leadId: string;
  canUpdateLead: boolean;
};

type Urgency = "High" | "Medium" | "Low";
type Stage =
  | "New"
  | "Contacted"
  | "Measurement Scheduled"
  | "Proposal Sent"
  | "Won";

type Lead = {
  id: string;
  name: string;
  phone: string;
  source: string;
  budget: number;
  stage: Stage;
  urgency: Urgency;
  notes: string;
  lastContact: string;
  hot: boolean;
  newToday: boolean;
  stageId: string;
  nextStageId: string | null;
};

type FilterType = "All" | "Hot" | "New Today";
type NotificationItem = { id: string; title: string; message: string };

type HubRailItem = { id: string };
type LeadDetailApiResponse = {
  lead?: {
    id: string;
    title: string;
    source: string;
    priority: string;
    contactName: string | null;
    phone: string | null;
    note: string | null;
    createdAt: string;
    updatedAt: string;
    lastActivityAt: string | null;
    stage: { slug: string; name: string; finalType: string | null };
    stageId: string;
    pipelineStages: Array<{ id: string; slug: string; name: string; sortOrder: number }>;
    estimates: Array<{ totalPrice: number | null }>;
    contact: { fullName: string; phone: string | null } | null;
    dealId: string | null;
  };
};

const INITIAL_RENDER_COUNT = 14;
const RENDER_STEP = 10;
const DETAIL_FETCH_CONCURRENCY = 8;
const MAX_HUB_RAIL_ITEMS = 120;
const LEAD_DETAILS_CACHE_TTL_MS = 60_000;
const LEAD_DETAILS_CACHE_MAX_ITEMS = 220;
const AUTO_REFRESH_INTERVAL_MS = 90_000;
const RAIL_FETCH_RETRIES = 1;
const DETAIL_FETCH_RETRIES = 1;
const FETCH_RETRY_DELAY_MS = 280;

const stages: Stage[] = [
  "New",
  "Contacted",
  "Measurement Scheduled",
  "Proposal Sent",
  "Won",
];

const stageLabels: Record<Stage, string> = {
  New: "Новий",
  Contacted: "Контакт встановлено",
  "Measurement Scheduled": "Заплановано замір",
  "Proposal Sent": "КП надіслано",
  Won: "Угоду виграно",
};

const urgencyLabels: Record<Urgency, string> = {
  High: "Висока",
  Medium: "Середня",
  Low: "Низька",
};

const filterLabels: Record<FilterType, string> = {
  All: "Усі",
  Hot: "Гарячі",
  "New Today": "Нові сьогодні",
};

const stageColors: Record<Stage, string> = {
  New: "from-cyan-400/20 to-blue-500/20 border-cyan-400/30",
  Contacted: "from-fuchsia-400/20 to-violet-500/20 border-fuchsia-400/30",
  "Measurement Scheduled":
    "from-amber-300/20 to-orange-500/20 border-amber-400/30",
  "Proposal Sent": "from-emerald-300/20 to-teal-500/20 border-emerald-400/30",
  Won: "from-lime-300/20 to-emerald-500/20 border-lime-400/40",
};

const cardGlow: Record<Urgency, string> = {
  High: "shadow-[0_0_0_1px_rgba(255,120,120,0.15),0_0_35px_rgba(255,90,90,0.12)]",
  Medium:
    "shadow-[0_0_0_1px_rgba(120,180,255,0.12),0_0_30px_rgba(90,140,255,0.08)]",
  Low: "shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_0_22px_rgba(255,255,255,0.04)]",
};

function mapStage(input: {
  slug: string;
  isWon: boolean;
  stageName: string;
}): Stage {
  const slug = input.slug.toLowerCase();
  const name = input.stageName.toLowerCase();
  if (input.isWon || slug.includes("won") || slug.includes("handoff")) return "Won";
  if (slug.includes("proposal") || slug.includes("price") || slug.includes("quote")) {
    return "Proposal Sent";
  }
  if (slug.includes("measure") || slug.includes("site")) return "Measurement Scheduled";
  if (slug === "new") return "New";
  if (name.includes("нов") || name.includes("new")) return "New";
  return "Contacted";
}

function mapUrgency(priority: string): Urgency {
  if (priority === "high") return "High";
  if (priority === "low") return "Low";
  return "Medium";
}

function formatRelativeTime(rawDate: string | null): string {
  if (!rawDate) return "без активності";
  const date = new Date(rawDate);
  const diffMs = Date.now() - date.getTime();
  if (Number.isNaN(diffMs) || diffMs < 0) return "щойно";
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "щойно";
  if (mins < 60) return `${mins} хв тому`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} год тому`;
  const days = Math.floor(hours / 24);
  return `${days} дн тому`;
}

function isToday(dateValue: string): boolean {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return false;
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("uk-UA", {
    style: "currency",
    currency: "UAH",
    maximumFractionDigits: 0,
  }).format(value);
}

function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}

function AnimatedBackground({ reduceMotion }: { reduceMotion: boolean }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.10),transparent_28%),radial-gradient(circle_at_top_right,rgba(168,85,247,0.12),transparent_26%),radial-gradient(circle_at_bottom_center,rgba(16,185,129,0.10),transparent_24%)]" />
      {!reduceMotion ? (
        <>
          <motion.div
            className="absolute -left-24 top-20 h-72 w-72 rounded-full bg-cyan-400/10 blur-3xl"
            animate={{ x: [0, 60, 0], y: [0, -20, 0] }}
            transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute right-0 top-0 h-96 w-96 rounded-full bg-fuchsia-500/10 blur-3xl"
            animate={{ x: [0, -40, 0], y: [0, 30, 0] }}
            transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
          />
        </>
      ) : null}
      <div className="absolute inset-0 opacity-[0.06] [background-image:linear-gradient(rgba(255,255,255,0.8)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.8)_1px,transparent_1px)] [background-size:48px_48px]" />
    </div>
  );
}

function KPI({
  title,
  value,
  icon: Icon,
  sub,
  delay = 0,
  reduceMotion,
}: {
  title: string;
  value: string | number;
  icon: ComponentType<{ className?: string }>;
  sub: string;
  delay?: number;
  reduceMotion: boolean;
}) {
  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 24, filter: "blur(8px)" }}
      animate={reduceMotion ? undefined : { opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] }}
      whileHover={reduceMotion ? undefined : { y: -4, scale: 1.01 }}
      className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-white/8 to-white/[0.02]" />
      <div className="relative flex items-start justify-between">
        <div>
          <p className="text-sm text-white/55">{title}</p>
          {reduceMotion ? (
            <h3 className="mt-3 text-3xl font-semibold tracking-tight text-white">{value}</h3>
          ) : (
            <motion.h3
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: delay + 0.12, duration: 0.35 }}
              className="mt-3 text-3xl font-semibold tracking-tight text-white"
            >
              {value}
            </motion.h3>
          )}
          <p className="mt-2 text-xs text-white/45">{sub}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/6 p-3 text-cyan-300 shadow-[0_0_30px_rgba(34,211,238,0.12)]">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </motion.div>
  );
}

function LeadCard({
  lead,
  onOpen,
  onTakeLead,
  onAdvance,
  canUpdateLead,
  reduceMotion,
}: {
  lead: Lead;
  onOpen: (lead: Lead) => void;
  onTakeLead: (lead: Lead) => void;
  onAdvance: (id: string) => void;
  canUpdateLead: boolean;
  reduceMotion: boolean;
}) {
  const pulse = lead.stage === "New";
  const isWon = lead.stage === "Won";

  return (
    <motion.div
      layout
      whileHover={reduceMotion ? undefined : { y: -6, scale: 1.015 }}
      whileTap={reduceMotion ? undefined : { scale: 0.99 }}
      className={cn(
        "group relative cursor-pointer overflow-hidden rounded-3xl border border-white/10 bg-white/[0.055] p-4 backdrop-blur-xl transition-all duration-300",
        cardGlow[lead.urgency],
        lead.hot &&
          "before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_top_right,rgba(255,90,90,0.22),transparent_42%)]",
        isWon && "ring-1 ring-emerald-300/30 shadow-[0_0_40px_rgba(52,211,153,0.18)]",
      )}
      onClick={() => onOpen(lead)}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        onOpen(lead);
      }}
      role="button"
      tabIndex={0}
      aria-label={`Відкрити деталі ліда ${lead.name}`}
      animate={
        pulse && !reduceMotion
          ? {
              boxShadow: [
                "0 0 0 rgba(34,211,238,0.0)",
                "0 0 30px rgba(34,211,238,0.13)",
                "0 0 0 rgba(34,211,238,0.0)",
              ],
            }
          : {}
      }
      transition={
        pulse ? { duration: 2.4, repeat: Infinity, ease: "easeInOut" } : { duration: 0.3 }
      }
    >
      <div className="relative z-10">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-semibold text-white">{lead.name}</h4>
              {lead.hot ? (
                <motion.span
                  animate={reduceMotion ? undefined : { scale: [1, 1.18, 1], opacity: [0.8, 1, 0.8] }}
                  transition={reduceMotion ? undefined : { duration: 1.8, repeat: Infinity }}
                  className="inline-flex items-center gap-1 rounded-full border border-red-400/20 bg-red-400/10 px-2 py-0.5 text-[10px] font-medium text-red-200"
                >
                  <Flame className="h-3 w-3" /> Гарячий
                </motion.span>
              ) : null}
            </div>
            <p className="mt-1 text-xs text-white/45">{lead.source}</p>
          </div>
          <div className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] text-white/60">
            {urgencyLabels[lead.urgency]}
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between text-xs text-white/60">
          <span className="flex items-center gap-1.5">
            <CircleDollarSign className="h-3.5 w-3.5" /> {formatCurrency(lead.budget)}
          </span>
          <span className="flex items-center gap-1.5">
            <Clock3 className="h-3.5 w-3.5" /> {lead.lastContact}
          </span>
        </div>

        {lead.stage === "New" ? (
          <div className="mt-4">
            <div className="mb-1 flex items-center justify-between text-[10px] text-cyan-200/80">
              <span>Вікно відповіді</span>
              <span>наживо</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/8">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-cyan-300 via-blue-400 to-violet-400"
                initial={{ width: "100%" }}
                animate={{ width: ["100%", "15%"] }}
                transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
              />
            </div>
          </div>
        ) : null}

        <p className="mt-4 line-clamp-2 text-xs leading-relaxed text-white/55">
          {lead.notes}
        </p>

        <div className="mt-4 flex items-center gap-2 opacity-0 transition duration-300 group-hover:opacity-100 group-focus-within:opacity-100">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onTakeLead(lead);
            }}
            disabled={!canUpdateLead}
            className="rounded-2xl border border-cyan-300/20 bg-cyan-400/10 px-3 py-2 text-xs font-medium text-cyan-100 shadow-[0_0_22px_rgba(34,211,238,0.12)] transition hover:bg-cyan-400/15"
          >
            Взяти лід
          </button>
          {lead.stage !== "Won" ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onAdvance(lead.id);
              }}
              disabled={!lead.nextStageId || !canUpdateLead}
              className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-white/80 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Наступний етап
            </button>
          ) : null}
        </div>
      </div>
    </motion.div>
  );
}

function Notification({
  item,
  onClose,
}: {
  item: NotificationItem;
  onClose: () => void;
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 40, scale: 0.96 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 30, scale: 0.95 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="w-[320px] rounded-3xl border border-white/10 bg-neutral-950/80 p-4 shadow-[0_10px_60px_rgba(0,0,0,0.45)] backdrop-blur-2xl"
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-2xl border border-white/10 bg-white/5 p-2 text-cyan-300">
          <Bell className="h-4 w-4" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-white">{item.title}</p>
          <p className="mt-1 text-xs leading-relaxed text-white/55">{item.message}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Закрити сповіщення"
          className="text-white/40 transition hover:text-white/80"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </motion.div>
  );
}

function DetailPanel({
  lead,
  onClose,
  onAdvance,
  canUpdateLead,
}: {
  lead: Lead | null;
  onClose: () => void;
  onAdvance: (id: string) => void;
  canUpdateLead: boolean;
}) {
  if (!lead) return null;

  const progress = ((stages.indexOf(lead.stage) + 1) / stages.length) * 100;
  const timeline = [
    "Лід створено з джерела",
    "Первинну кваліфікацію перевірено",
    lead.stage === "New" ? "Очікує першої відповіді" : "Першу відповідь надіслано",
    lead.stage === "Measurement Scheduled" ||
    lead.stage === "Proposal Sent" ||
    lead.stage === "Won"
      ? "Подію заміру зафіксовано"
      : "Замір очікується",
    lead.stage === "Proposal Sent" || lead.stage === "Won"
      ? "Комерційну пропозицію надіслано клієнту"
      : "Комерційну пропозицію ще не надіслано",
    lead.stage === "Won"
      ? "Угоду підтверджено і передано у виробництво"
      : "Відкрита можливість",
  ];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex justify-end bg-black/45 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ x: 520, opacity: 0.7 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 520, opacity: 0.7 }}
          transition={{ type: "spring", stiffness: 180, damping: 24 }}
          onClick={(e) => e.stopPropagation()}
          className="relative h-full w-full max-w-xl overflow-y-auto border-l border-white/10 bg-neutral-950/90 p-6 backdrop-blur-2xl"
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.10),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(168,85,247,0.12),transparent_26%)]" />
          <div className="relative">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-2xl font-semibold tracking-tight text-white">
                    {lead.name}
                  </h2>
                  {lead.hot ? (
                    <span className="rounded-full border border-red-400/20 bg-red-400/10 px-2 py-1 text-[10px] font-medium text-red-200">
                      Гарячий лід
                    </span>
                  ) : null}
                </div>
                <p className="mt-2 text-sm text-white/55">
                  {lead.source} • {lead.phone}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Закрити панель деталей ліда"
                className="rounded-2xl border border-white/10 bg-white/5 p-2 text-white/60 transition hover:bg-white/10 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-6 rounded-3xl border border-white/10 bg-white/[0.045] p-5">
              <div className="flex items-center justify-between">
                <p className="text-sm text-white/60">Прогрес воронки</p>
                <p className="text-sm font-medium text-white">{stageLabels[lead.stage]}</p>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/8">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-cyan-300 via-violet-400 to-emerald-300"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                />
              </div>
              <div className="mt-4 grid grid-cols-5 gap-2">
                {stages.map((s, i) => {
                  const active = i <= stages.indexOf(lead.stage);
                  return (
                    <div key={s} className="flex flex-col items-center gap-2">
                      <div
                        className={cn(
                          "h-2.5 w-2.5 rounded-full",
                          active
                            ? "bg-white shadow-[0_0_12px_rgba(255,255,255,0.6)]"
                            : "bg-white/20",
                        )}
                      />
                      <span className="text-center text-[10px] leading-tight text-white/45">
                        {stageLabels[s]}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-4">
              {[
                {
                  label: "Бюджет",
                  value: formatCurrency(lead.budget),
                  icon: CircleDollarSign,
                },
                { label: "Терміновість", value: urgencyLabels[lead.urgency], icon: Flame },
                { label: "Останній контакт", value: lead.lastContact, icon: Clock3 },
                { label: "Джерело", value: lead.source, icon: Layers3 },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-3xl border border-white/10 bg-white/[0.04] p-4"
                >
                  <div className="flex items-center gap-2 text-white/45">
                    <item.icon className="h-4 w-4" />
                    <span className="text-xs">{item.label}</span>
                  </div>
                  <p className="mt-3 text-sm font-medium text-white">{item.value}</p>
                </div>
              ))}
            </div>

            <div className="mt-6 rounded-3xl border border-white/10 bg-white/[0.04] p-5">
              <p className="text-sm font-medium text-white">Нотатки</p>
              <p className="mt-3 text-sm leading-relaxed text-white/60">{lead.notes}</p>
            </div>

            <div className="mt-6 rounded-3xl border border-white/10 bg-white/[0.04] p-5">
              <p className="text-sm font-medium text-white">Таймлайн активності</p>
              <div className="mt-4 space-y-3">
                {timeline.map((item, idx) => (
                  <motion.div
                    key={item}
                    initial={{ opacity: 0, x: 12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="flex gap-3"
                  >
                    <div className="mt-1 h-2.5 w-2.5 rounded-full bg-cyan-300 shadow-[0_0_12px_rgba(34,211,238,0.6)]" />
                    <div>
                      <p className="text-sm text-white/75">{item}</p>
                      <p className="mt-1 text-xs text-white/35">Подія активності</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <button className="rounded-2xl border border-cyan-300/20 bg-cyan-400/10 px-4 py-3 text-sm font-medium text-cyan-100 shadow-[0_0_22px_rgba(34,211,238,0.12)] transition hover:bg-cyan-400/15">
                Зателефонувати клієнту
              </button>
              <button type="button" className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white/80 transition hover:bg-white/10">
                Запланувати замір
              </button>
              {lead.stage !== "Won" ? (
                <button
                  type="button"
                  onClick={() => onAdvance(lead.id)}
                  disabled={!lead.nextStageId || !canUpdateLead}
                  className="rounded-2xl border border-emerald-300/20 bg-emerald-400/10 px-4 py-3 text-sm font-medium text-emerald-100 shadow-[0_0_22px_rgba(52,211,153,0.12)] transition hover:bg-emerald-400/15 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Перевести на наступний етап
                </button>
              ) : null}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export function LeadHubNotesCard({ leadId, canUpdateLead }: Props) {
  const reduceMotion = useReducedMotion();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [filter, setFilter] = useState<FilterType>("All");
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [wonPulse, setWonPulse] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const notificationTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const queueLimitNoticeRef = useRef(false);
  const coverageNoticeRef = useRef(false);
  const leadDetailsCacheRef = useRef<Map<string, CacheEntry<Lead>>>(new Map());
  const hadLeadsRef = useRef(false);
  const refreshInFlightRef = useRef(false);

  const dismissNotification = useCallback((id: string) => {
    const timer = notificationTimersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      notificationTimersRef.current.delete(id);
    }
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const normalizedSearch = deferredSearch.trim().toLowerCase();
  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      const matchesSearch =
        lead.name.toLowerCase().includes(normalizedSearch) ||
        lead.source.toLowerCase().includes(normalizedSearch) ||
        lead.notes.toLowerCase().includes(normalizedSearch);

      const matchesFilter =
        filter === "All" ||
        (filter === "Hot" && lead.hot) ||
        (filter === "New Today" && lead.newToday);

      return matchesSearch && matchesFilter;
    });
  }, [filter, leads, normalizedSearch]);

  const grouped = useMemo(() => {
    return stages.reduce<Record<Stage, Lead[]>>((acc, stage) => {
      acc[stage] = filteredLeads.filter((lead) => lead.stage === stage);
      return acc;
    }, {} as Record<Stage, Lead[]>);
  }, [filteredLeads]);
  const [renderCounts, setRenderCounts] = useState<Record<Stage, number>>({
    New: INITIAL_RENDER_COUNT,
    Contacted: INITIAL_RENDER_COUNT,
    "Measurement Scheduled": INITIAL_RENDER_COUNT,
    "Proposal Sent": INITIAL_RENDER_COUNT,
    Won: INITIAL_RENDER_COUNT,
  });

  const revenue = useMemo(
    () => leads.filter((l) => l.stage === "Won").reduce((sum, l) => sum + l.budget, 0),
    [leads],
  );

  useEffect(() => {
    hadLeadsRef.current = leads.length > 0;
  }, [leads.length]);

  useEffect(() => {
    setRenderCounts({
      New: INITIAL_RENDER_COUNT,
      Contacted: INITIAL_RENDER_COUNT,
      "Measurement Scheduled": INITIAL_RENDER_COUNT,
      "Proposal Sent": INITIAL_RENDER_COUNT,
      Won: INITIAL_RENDER_COUNT,
    });
  }, [deferredSearch, filter]);

  const pushNotification = useCallback((title: string, message: string) => {
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    setNotifications((prev) => [{ id, title, message }, ...prev].slice(0, 4));
    const timer = setTimeout(() => dismissNotification(id), 3200);
    notificationTimersRef.current.set(id, timer);
  }, [dismissNotification]);

  const hydrateLead = useCallback((raw: NonNullable<LeadDetailApiResponse["lead"]>): Lead => {
    const bySort = [...raw.pipelineStages].sort((a, b) => a.sortOrder - b.sortOrder);
    const idx = bySort.findIndex((s) => s.id === raw.stageId);
    const nextStageId =
      idx >= 0 && idx < bySort.length - 1 ? bySort[idx + 1]?.id ?? null : null;
    const stage = mapStage({
      slug: raw.stage.slug,
      isWon: Boolean(raw.dealId) || raw.stage.finalType === "SUCCESS",
      stageName: raw.stage.name,
    });
    return {
      id: raw.id,
      name: raw.contact?.fullName || raw.contactName || raw.title,
      phone: raw.contact?.phone || raw.phone || "—",
      source: raw.source,
      budget: raw.estimates[0]?.totalPrice ?? 0,
      stage,
      urgency: mapUrgency(raw.priority),
      notes: raw.note?.trim() || "Нотаток поки немає.",
      lastContact: formatRelativeTime(raw.lastActivityAt ?? raw.updatedAt),
      hot: raw.priority === "high",
      newToday: isToday(raw.createdAt),
      stageId: raw.stageId,
      nextStageId,
    };
  }, []);

  const loadLeads = useCallback(async (signal?: AbortSignal) => {
    const hadLeadsBefore = hadLeadsRef.current;
    setLoading(true);
    setLoadError(null);
    try {
      const railRes = await retryAsync(
        async () => fetch("/api/leads/hub-rail?view=all", { signal }),
        {
          retries: RAIL_FETCH_RETRIES,
          delayMs: FETCH_RETRY_DELAY_MS,
          shouldRetry: (error) => !(error instanceof DOMException && error.name === "AbortError"),
        },
      );
      const railJson = (await railRes.json()) as { items?: HubRailItem[]; error?: string };
      if (!railRes.ok) throw new Error(railJson.error ?? "Не вдалося завантажити список лідів");
      const allIds = (railJson.items ?? []).map((item) => item.id);
      const { ids, skipped } = trimHubRailIds(allIds, MAX_HUB_RAIL_ITEMS);
      const nowMs = Date.now();
      const detailResults = await mapWithConcurrency(ids, DETAIL_FETCH_CONCURRENCY, async (id) => {
        if (signal?.aborted) return null;
        const cached = readFreshCache(
          leadDetailsCacheRef.current,
          id,
          LEAD_DETAILS_CACHE_TTL_MS,
          nowMs,
        );
        if (cached) {
          return cached;
        }
        const r = await retryAsync(
          async () => fetch(`/api/leads/${id}`, { signal }),
          {
            retries: DETAIL_FETCH_RETRIES,
            delayMs: FETCH_RETRY_DELAY_MS,
            shouldRetry: (error) =>
              !(error instanceof DOMException && error.name === "AbortError"),
          },
        );
        if (!r.ok) return null;
        const j = (await r.json()) as LeadDetailApiResponse;
        if (!j.lead) return null;
        const hydrated = hydrateLead(j.lead);
        writeCache(leadDetailsCacheRef.current, id, hydrated, nowMs);
        enforceCacheSize(leadDetailsCacheRef.current, LEAD_DETAILS_CACHE_MAX_ITEMS);
        return hydrated;
      });
      if (signal?.aborted) return;
      pruneExpiredCache(leadDetailsCacheRef.current, LEAD_DETAILS_CACHE_TTL_MS, nowMs);
      enforceCacheSize(leadDetailsCacheRef.current, LEAD_DETAILS_CACHE_MAX_ITEMS);
      const nextLeads = detailResults.filter((item): item is Lead => item !== null);
      setLeads(nextLeads);
      if (skipped > 0 && !queueLimitNoticeRef.current) {
        queueLimitNoticeRef.current = true;
        pushNotification(
          "Велика черга лідів",
          `Показано перші ${MAX_HUB_RAIL_ITEMS} лідів для швидкої роботи. Залишок: ${skipped}.`,
        );
      }
      if (skipped === 0) {
        queueLimitNoticeRef.current = false;
      }
      if (
        nextLeads.length > 0 &&
        !nextLeads.some((item) => item.id === leadId) &&
        !coverageNoticeRef.current
      ) {
        coverageNoticeRef.current = true;
        pushNotification(
          "Охоплення LeadHub",
          "В цій вкладці завантажено активну чергу лідів із CRM API.",
        );
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setLoadError(error instanceof Error ? error.message : "Помилка завантаження лідів");
      if (!hadLeadsBefore) {
        setLeads([]);
      } else {
        pushNotification(
          "Тимчасова помилка синхронізації",
          "Показуємо останні доступні дані. Повторіть оновлення трохи пізніше.",
        );
      }
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  }, [hydrateLead, leadId, pushNotification]);

  const runAutoRefresh = useCallback(async () => {
    if (document.visibilityState !== "visible") return;
    if (refreshInFlightRef.current) return;
    refreshInFlightRef.current = true;
    try {
      await loadLeads();
    } finally {
      refreshInFlightRef.current = false;
    }
  }, [loadLeads]);

  const advanceLead = async (id: string) => {
    const target = leads.find((lead) => lead.id === id);
    if (!target || !target.nextStageId || !canUpdateLead) return;
    try {
      const r = await fetch(`/api/leads/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stageId: target.nextStageId }),
      });
      const j = (await r.json()) as {
        error?: string;
        lead?: { stageId: string; updatedAt: string };
      };
      if (!r.ok) {
        throw new Error(j.error ?? "Не вдалося оновити стадію");
      }
      setLeads((prev) =>
        prev.map((lead) => {
          if (lead.id !== id) return lead;
          const idx = stages.indexOf(lead.stage);
          const nextStage = stages[Math.min(idx + 1, stages.length - 1)];
          const updated: Lead = {
            ...lead,
            stage: nextStage,
            stageId: j.lead?.stageId ?? lead.stageId,
            lastContact: "щойно",
            nextStageId:
              j.lead?.stageId === lead.nextStageId ? null : lead.nextStageId,
          };
          writeCache(leadDetailsCacheRef.current, id, updated);
          enforceCacheSize(leadDetailsCacheRef.current, LEAD_DETAILS_CACHE_MAX_ITEMS);
          if (selectedLead?.id === id) setSelectedLead(updated);
          if (nextStage === "Won" && lead.stage !== "Won") {
            setWonPulse(true);
            window.setTimeout(() => setWonPulse(false), 1600);
            pushNotification("Угоду виграно", `${lead.name}: лід переведено в статус «Угоду виграно».`);
          } else {
            pushNotification("Статус оновлено", `${lead.name}: новий етап — ${stageLabels[nextStage]}.`);
          }
          return updated;
        }),
      );
      void loadLeads();
    } catch (error) {
      pushNotification(
        "Оновлення не виконано",
        error instanceof Error ? error.message : "Не вдалося оновити стадію",
      );
    }
  };

  const takeLead = (lead: Lead) => {
    pushNotification("Лід призначено", `${lead.name} тепер у вашій активній черзі.`);
  };

  useEffect(() => {
    const controller = new AbortController();
    void loadLeads(controller.signal);
    return () => controller.abort();
  }, [loadLeads]);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void runAutoRefresh();
      }
    };
    const intervalId = window.setInterval(() => {
      void runAutoRefresh();
    }, AUTO_REFRESH_INTERVAL_MS);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [runAutoRefresh]);

  useEffect(() => {
    const timer = setTimeout(() => {
      pushNotification("Живий сигнал", "Стрічка лідів CRM синхронізована з даними робочого простору.");
    }, 1300);
    return () => clearTimeout(timer);
  }, [pushNotification]);

  useEffect(() => {
    const timers = notificationTimersRef.current;
    return () => {
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
    };
  }, []);

  const kpis = [
    {
      title: "Нові ліди сьогодні",
      value: leads.filter((l) => l.newToday).length,
      icon: Sparkles,
      sub: "Свіжі вхідні звернення",
      delay: 0.05,
    },
    {
      title: "Швидкість реакції",
      value: "4,2 хв",
      icon: Clock3,
      sub: "Середній час першого контакту",
      delay: 0.1,
    },
    {
      title: "Заміри",
      value: leads.filter((l) => l.stage === "Measurement Scheduled").length,
      icon: Calendar,
      sub: "Заплановані виїзди",
      delay: 0.15,
    },
    {
      title: "Виграні угоди",
      value: leads.filter((l) => l.stage === "Won").length,
      icon: BadgeCheck,
      sub: "Закриті можливості",
      delay: 0.2,
    },
    {
      title: "Виручка",
      value: formatCurrency(revenue),
      icon: TrendingUp,
      sub: "Вартість виграної воронки",
      delay: 0.25,
    },
  ];
  const isInitialLoading = loading && leads.length === 0;
  const isRefreshing = loading && leads.length > 0;

  return (
    <div className="lead-hub-root lead-hub-shell enver-readable min-h-screen bg-[var(--enver-bg)] text-[var(--enver-text)]">
      <div className="relative min-h-screen overflow-hidden">
        <AnimatedBackground reduceMotion={reduceMotion} />

        <AnimatePresence>
          {wonPulse && !reduceMotion ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="pointer-events-none fixed inset-0 z-40"
            >
              <div className="absolute inset-0 bg-[radial-gradient(circle,rgba(52,211,153,0.18),transparent_35%)]" />
              {Array.from({ length: 22 }).map((_, i) => (
                <motion.div
                  key={i}
                  initial={{ x: "50vw", y: "46vh", scale: 0.2, opacity: 1 }}
                  animate={{
                    x: `calc(50vw + ${Math.cos((i / 22) * Math.PI * 2) * (140 + i * 5)}px)`,
                    y: `calc(46vh + ${Math.sin((i / 22) * Math.PI * 2) * (120 + i * 4)}px)`,
                    scale: 1,
                    opacity: 0,
                    rotate: 180 + i * 12,
                  }}
                  transition={{ duration: 1.2, ease: "easeOut" }}
                  className="absolute h-3 w-3 rounded-md bg-white/90 shadow-[0_0_12px_rgba(255,255,255,0.8)]"
                />
              ))}
            </motion.div>
          ) : null}
        </AnimatePresence>

        <div className="relative z-10 mx-auto max-w-[1720px] px-6 py-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-6 flex flex-col gap-5 rounded-[24px] border border-[var(--enver-border)] bg-[var(--enver-card)]/75 p-6 backdrop-blur-xl lg:flex-row lg:items-center lg:justify-between"
          >
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/15 bg-cyan-300/10 px-3 py-1 text-xs font-medium text-cyan-100">
                <Sparkles className="h-3.5 w-3.5" /> LeadHub з преміальною анімацією
              </div>
              <h1 className="mt-4 text-3xl font-semibold tracking-tight text-[var(--enver-text)] md:text-5xl">
                Ліди, але з{" "}
                <span className="bg-gradient-to-r from-cyan-300 via-white to-fuchsia-300 bg-clip-text text-transparent">
                  живою присутністю
                </span>
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--enver-text-muted)] md:text-base">
                Швидка робота з лідами для продажу меблів під замовлення, у кінематографічному
                інтерфейсі з живими індикаторами терміновості та плавною анімацією.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Пошук за лідами, нотатками, джерелом..."
                  className="w-full rounded-2xl border border-white/10 bg-black/20 py-3 pl-11 pr-4 text-sm text-white placeholder:text-white/30 outline-none ring-0 transition focus:border-cyan-300/25 focus:bg-black/30 sm:w-[300px]"
                />
              </div>
              <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-black/20 p-1.5">
                {(["All", "Hot", "New Today"] as const).map((item) => (
                  <button
                    key={item}
                    onClick={() => setFilter(item)}
                    className={cn(
                      "rounded-xl px-4 py-2 text-sm transition",
                      filter === item
                        ? "bg-white text-neutral-900 shadow-[0_0_18px_rgba(255,255,255,0.2)]"
                        : "text-white/60 hover:text-white",
                    )}
                  >
                    {filterLabels[item]}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>

          {loadError ? (
            <div
              role="status"
              aria-live="polite"
              className="mb-4 rounded-2xl border border-rose-300/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100"
            >
              {loadError}
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
            {kpis.map((kpi) => (
              <KPI key={kpi.title} {...kpi} reduceMotion={reduceMotion} />
            ))}
          </div>

          {isInitialLoading ? (
            <div className="mt-8 rounded-3xl border border-white/10 bg-white/[0.03] p-6 text-sm text-white/70">
              Завантаження лідів CRM...
            </div>
          ) : null}
          {isRefreshing ? (
            <div className="mt-3 text-right text-xs text-cyan-200/70">Оновлюємо дані...</div>
          ) : null}

          <div className="mt-8 grid grid-cols-1 gap-5 xl:grid-cols-5">
            {stages.map((stage, colIdx) => (
              <motion.div
                key={stage}
                initial={{ opacity: 0, y: 22 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.08 * colIdx, duration: 0.5 }}
                className={cn(
                  "relative overflow-hidden rounded-[28px] border bg-gradient-to-b p-4 backdrop-blur-xl",
                  stageColors[stage],
                )}
              >
                <div className="absolute inset-0 bg-black/30" />
                <div className="relative">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-white">{stageLabels[stage]}</h3>
                      <p className="mt-1 text-xs text-white/45">
                        {grouped[stage].length} лідів
                      </p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/8 px-2.5 py-1 text-xs text-white/60">
                      {colIdx + 1}
                    </div>
                  </div>

                  <motion.div
                    layout
                    className="max-h-[68vh] min-h-[520px] space-y-3 overflow-y-auto pr-1"
                    onScroll={(event) => {
                      const el = event.currentTarget;
                      const nearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 180;
                      if (!nearBottom) return;
                      setRenderCounts((prev) => {
                        const current = prev[stage] ?? INITIAL_RENDER_COUNT;
                        const total = grouped[stage].length;
                        if (current >= total) return prev;
                        return {
                          ...prev,
                          [stage]: Math.min(total, current + RENDER_STEP),
                        };
                      });
                    }}
                  >
                    <AnimatePresence>
                      {grouped[stage].slice(0, renderCounts[stage] ?? INITIAL_RENDER_COUNT).map((lead) => (
                        <LeadCard
                          key={lead.id}
                          lead={lead}
                          onOpen={setSelectedLead}
                          onTakeLead={takeLead}
                          onAdvance={advanceLead}
                          canUpdateLead={canUpdateLead}
                          reduceMotion={reduceMotion}
                        />
                      ))}
                    </AnimatePresence>

                    {grouped[stage].length > (renderCounts[stage] ?? INITIAL_RENDER_COUNT) ? (
                      <div className="px-2 pb-1 pt-2 text-center text-[11px] text-white/45">
                        Показано {renderCounts[stage] ?? INITIAL_RENDER_COUNT} з {grouped[stage].length}. Прокрутіть нижче для підвантаження.
                      </div>
                    ) : null}

                    {grouped[stage].length === 0 ? (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex min-h-[160px] flex-col items-center justify-center rounded-3xl border border-dashed border-white/10 bg-white/[0.03] p-6 text-center"
                      >
                        <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-white/35">
                          <Layers3 className="h-5 w-5" />
                        </div>
                        <p className="mt-4 text-sm text-white/55">У цій колонці немає лідів</p>
                        <p className="mt-1 text-xs text-white/35">
                          Навіть порожній стан виглядає преміально.
                        </p>
                      </motion.div>
                    ) : null}
                  </motion.div>
                </div>
              </motion.div>
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mt-8 grid grid-cols-1 gap-5 lg:grid-cols-[1.25fr_0.75fr]"
          >
            <div className="rounded-[24px] border border-[var(--enver-border)] bg-[var(--enver-card)]/80 p-5 backdrop-blur-xl">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-white">Жива активність</h3>
                  <p className="mt-1 text-sm text-white/45">Сигнали продажів у реальному часі</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/60">
                  Потік
                </div>
              </div>
              <div className="mt-5 space-y-3">
                {[
                  "Клієнт підтвердив бажаний слот для заміру.",
                  "Клієнт двічі відкрив повідомлення з ціною за 10 хвилин.",
                  "Клієнт переглянув PDF комерційної пропозиції та запросив зразки фурнітури.",
                  "Клієнт відповів після першої спроби контакту.",
                ].map((item, idx) => (
                  <motion.div
                    key={item}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.35 + idx * 0.06 }}
                    className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] p-4"
                  >
                    <div className="flex items-center gap-3">
                      <div className="rounded-2xl border border-cyan-300/15 bg-cyan-300/10 p-2 text-cyan-200">
                        <User className="h-4 w-4" />
                      </div>
                      <p className="text-sm text-white/72">{item}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-white/30" />
                  </motion.div>
                ))}
              </div>
            </div>

            <div className="rounded-[24px] border border-[var(--enver-border)] bg-[var(--enver-card)]/80 p-5 backdrop-blur-xl">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-white">Фокус на конверсії</h3>
                  <p className="mt-1 text-sm text-white/45">Візуальні індикатори терміновості</p>
                </div>
                <Filter className="h-4 w-4 text-white/35" />
              </div>
              <div className="mt-6 space-y-5">
                {[
                  {
                    label: "Гарячі ліди",
                    value: `${leads.filter((l) => l.hot).length}`,
                    width: "76%",
                  },
                  { label: "Охоплення швидкої відповіді", value: "84%", width: "84%" },
                  { label: "Якість супроводу КП", value: "63%", width: "63%" },
                ].map((item) => (
                  <div key={item.label}>
                    <div className="mb-2 flex items-center justify-between text-sm">
                      <span className="text-white/65">{item.label}</span>
                      <span className="text-white">{item.value}</span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-white/8">
                      <motion.div
                        className="h-full rounded-full bg-gradient-to-r from-cyan-300 via-violet-400 to-fuchsia-400"
                        initial={{ width: 0 }}
                        animate={{ width: item.width }}
                        transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>

        <div className="fixed right-5 top-5 z-50 space-y-3">
          <AnimatePresence>
            {notifications.map((item) => (
              <Notification
                key={item.id}
                item={item}
                onClose={() => dismissNotification(item.id)}
              />
            ))}
          </AnimatePresence>
        </div>

        <DetailPanel
          lead={selectedLead}
          onClose={() => setSelectedLead(null)}
          onAdvance={advanceLead}
          canUpdateLead={canUpdateLead}
        />
      </div>
    </div>
  );
}
