import Link from "next/link";
import type React from "react";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Inbox,
  MessageCircle,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";
import type {
  DashboardPerms,
  DashboardSnapshot,
} from "../../features/dashboard/queries";
import { DashboardAiSummary } from "./DashboardAiSummary";

const sampleAiSummary = {
  title: "AI-огляд дня",
  highlight:
    "Сьогодні ключовий фокус — заміри та передача у виробництво.",
  bullets: [
    "Пріоритезуйте відповіді на ліди без реакції понад 24 години.",
    "Перевірте задачі з простроченим дедлайном.",
    "Контролюйте передачі у виробництво зі статусом «Надіслано».",
  ],
};

type KpiCardProps = {
  label: string;
  value: string;
  trendLabel?: string;
  trendValue?: string;
  tone?: "neutral" | "positive" | "negative";
  icon: React.ElementType;
};

const kpiToneStyles: Record<
  NonNullable<KpiCardProps["tone"]>,
  string
> = {
  neutral: "border-slate-200 bg-slate-50/80",
  positive: "border-emerald-100 bg-emerald-50/60",
  negative: "border-rose-100 bg-rose-50/60",
};

function KpiCard({
  label,
  value,
  trendLabel,
  trendValue,
  tone = "neutral",
  icon: Icon,
}: KpiCardProps) {
  const toneClass = kpiToneStyles[tone];

  return (
    <div
      className={`group relative overflow-hidden rounded-lg border ${toneClass} p-4 shadow-[0_1px_3px_rgba(0,0,0,0.06)] transition hover:-translate-y-0.5 hover:shadow-md`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
            {label}
          </p>
          <p className="text-2xl font-semibold tracking-tight text-[var(--enver-text)]">
            {value}
          </p>
          {trendLabel && trendValue ? (
            <p className="text-[11px] text-slate-500">
              {trendLabel}{" "}
              <span
                className={
                  tone === "positive"
                    ? "text-emerald-600"
                    : tone === "negative"
                      ? "text-rose-600"
                      : "text-slate-600"
                }
              >
                {trendValue}
              </span>
            </p>
          ) : null}
        </div>
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#3E2A5A] text-white shadow-sm shadow-[#3E2A5A]/25">
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
}

type AgendaItem = {
  id: string;
  time: string;
  label: string;
  type:
    | "measurement"
    | "call"
    | "meeting"
    | "installation"
    | "deadline"
    | "delivery"
    | "internal";
  context: string;
};

const agendaTypeStyles: Record<AgendaItem["type"], string> = {
  measurement:
    "border-sky-100 bg-sky-50/70 text-sky-800",
  call: "border-violet-100 bg-violet-50/70 text-violet-800",
  meeting: "border-amber-100 bg-amber-50/70 text-amber-800",
  installation:
    "border-emerald-100 bg-emerald-50/70 text-emerald-800",
  deadline:
    "border-rose-100 bg-rose-50/70 text-rose-800",
  delivery:
    "border-teal-100 bg-teal-50/70 text-teal-800",
  internal:
    "border-slate-200 bg-slate-100/80 text-slate-700",
};

function agendaTypeLabel(t: AgendaItem["type"]) {
  switch (t) {
    case "measurement":
      return "ЗАМІР";
    case "call":
      return "ДЗВІНОК";
    case "meeting":
      return "ЗУСТРІЧ";
    case "installation":
      return "МОНТАЖ";
    case "delivery":
      return "ДОСТАВКА";
    case "internal":
      return "ІНШЕ";
    default:
      return "ДЕДЛАЙН";
  }
}

const quickBtnClass =
  "inline-flex items-center justify-center rounded-lg border border-slate-200 bg-[var(--enver-card)] px-3 py-2 text-xs font-medium text-slate-800 shadow-[0_1px_3px_rgba(0,0,0,0.06)] transition hover:border-slate-300 hover:bg-[var(--enver-bg)]";

const handoffToneBorder: Record<
  "neutral" | "emerald" | "sky" | "amber",
  string
> = {
  neutral: "border-slate-100 bg-slate-50/70",
  emerald: "border-emerald-100 bg-emerald-50/70",
  sky: "border-sky-100 bg-sky-50/70",
  amber: "border-amber-100 bg-amber-50/70",
};

const handoffToneLabel: Record<
  "neutral" | "emerald" | "sky" | "amber",
  string
> = {
  neutral: "text-slate-500",
  emerald: "text-emerald-600",
  sky: "text-sky-700",
  amber: "text-amber-700",
};

function teamStateLabel(deals: number, tasks: number) {
  const sum = deals + tasks;
  if (sum >= 14) return "високе навантаження";
  if (sum >= 8) return "потрібен буфер";
  return "стабільно";
}

type Props = {
  perms: DashboardPerms;
  snapshot: DashboardSnapshot;
  /** Нормалізований JSON для операційного AI brief (сервер, у межах прав). */
  dashboardAiBriefContext?: string;
  nocUnreadCount?: number;
  nocPreview?: Array<{
    id: string;
    userId: string;
    channel: string;
    kind: "delivery_failed" | "outbound_failed";
    message: string;
    count: number;
    createdAt: string;
    readAt?: string;
  }>;
};

export function DashboardHomeView({
  perms,
  snapshot,
  dashboardAiBriefContext,
  nocUnreadCount = 0,
  nocPreview = [],
}: Props) {
  const leadDelta =
    snapshot.kpiNewLeads24h - snapshot.kpiNewLeadsPrev24h;
  const leadTrendValue =
    leadDelta === 0
      ? "як за попередні 24 год"
      : leadDelta > 0
        ? `+${leadDelta} vs попередні 24 год`
        : `${leadDelta} vs попередні 24 год`;

  const kpiItems: React.ReactNode[] = [];
  if (perms.leadsView) {
    kpiItems.push(
      <KpiCard
        key="leads"
        label="Нові ліди"
        value={String(snapshot.kpiNewLeads24h)}
        trendLabel="за останні 24 години"
        trendValue={leadTrendValue}
        tone={leadDelta > 0 ? "positive" : "neutral"}
        icon={Users}
      />,
    );
  }
  if (perms.dealsView) {
    kpiItems.push(
      <KpiCard
        key="deals"
        label="Активні угоди"
        value={String(snapshot.kpiOpenDeals)}
        trendLabel="в роботі"
        trendValue={
          snapshot.kpiDealsInContractStage > 0
            ? `${snapshot.kpiDealsInContractStage} на етапі договору`
            : "без угод на етапі договору"
        }
        tone="neutral"
        icon={TrendingUp}
      />,
    );
  }
  if (perms.tasksView) {
    kpiItems.push(
      <KpiCard
        key="tasks"
        label="Прострочені задачі"
        value={String(snapshot.kpiOverdueTasks)}
        trendLabel="потребують уваги"
        trendValue={
          snapshot.kpiOverdueTasks > 0
            ? "перегляньте /tasks/overdue"
            : "все вчасно"
        }
        tone={
          snapshot.kpiOverdueTasks > 0 ? "negative" : "positive"
        }
        icon={AlertTriangle}
      />,
    );
  }

  const kpiGridClass =
    kpiItems.length >= 3
      ? "md:grid-cols-3"
      : kpiItems.length === 2
        ? "md:grid-cols-2"
        : "md:grid-cols-1";

  const showAttentionBlock =
    perms.leadsView || perms.dealsView || perms.tasksView;
  const showAgenda = perms.calendarView;
  const showDealsCol = perms.dealsView;
  const showInbox = perms.notificationsView;
  const showHandoff = perms.dealsView;
  const showFunnel = perms.leadsView && snapshot.funnel.length > 0;
  const showTeam =
    snapshot.teamLoad.length > 0 &&
    (perms.dealsView || perms.tasksView);

  return (
    <main className="flex min-h-[calc(100vh-56px)] flex-col bg-[var(--enver-bg)] px-3 py-3 md:px-6 md:py-4">
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col space-y-4 md:space-y-6">
        <section className="flex flex-col gap-3 rounded-lg border border-slate-200/90 bg-[var(--enver-card)] px-4 py-3 shadow-[0_1px_3px_rgba(0,0,0,0.06)] md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-orange-600">
              ENVER CRM
            </p>
            <h1 className="text-xl font-semibold tracking-tight text-[var(--enver-text)] md:text-2xl">
              Операційний дашборд
            </h1>
            <p className="max-w-xl text-xs text-slate-600 md:text-sm">
              Показники та списки враховують вашу роль і права доступу. Дані
              обмежені видимістю лідів, угод, календаря та задач за правилами
              CRM.
            </p>
          </div>

          <div className="flex flex-col gap-2 md:w-[360px]">
            <div className="grid grid-cols-2 gap-2">
              {perms.leadsView ? (
                <Link
                  href="/leads"
                  className={quickBtnClass}
                >
                  {perms.leadsCreate
                    ? "Новий лід"
                    : "Ліди"}
                </Link>
              ) : null}
              {perms.dealsView ? (
                <Link href="/deals" className={quickBtnClass}>
                  {perms.dealsCreate ? "Нова угода" : "Угоди"}
                </Link>
              ) : null}
              {perms.calendarView ? (
                <Link
                  href="/calendar/measurements"
                  className={quickBtnClass}
                >
                  Календар / заміри
                </Link>
              ) : null}
              {perms.tasksView ? (
                <Link
                  href={
                    perms.tasksCreate
                      ? "/tasks/today"
                      : "/tasks"
                  }
                  className={quickBtnClass}
                >
                  {perms.tasksCreate
                    ? "Задачі"
                    : "Задачі"}
                </Link>
              ) : null}
            </div>

            <div className="flex items-start gap-3 rounded-2xl border border-sky-100 bg-sky-50/60 px-3 py-2.5 text-xs text-slate-700 shadow-sm shadow-sky-100">
              <div className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-sky-600 text-slate-50 shadow-sm shadow-sky-600/40">
                <Sparkles className="h-3.5 w-3.5" />
              </div>
              <div className="space-y-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sky-700">
                  AI-огляд
                </p>
                <DashboardAiSummary
                  fallback={sampleAiSummary.highlight}
                  dashboardBriefContext={dashboardAiBriefContext}
                />
              </div>
            </div>
            {perms.notificationsView ? (
              <Link
                href="/dashboard/critical"
                className="flex items-center justify-between rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs text-rose-900 shadow-sm shadow-rose-100 transition hover:bg-rose-100"
              >
                <span className="inline-flex items-center gap-1.5 font-medium">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  NOC alerts
                </span>
                <span className="rounded-full bg-rose-600 px-2 py-0.5 text-[10px] font-semibold text-white">
                  {nocUnreadCount > 99 ? "99+" : nocUnreadCount}
                </span>
              </Link>
            ) : null}
          </div>
        </section>

        {kpiItems.length > 0 ? (
          <section className={`grid gap-3 ${kpiGridClass}`}>
            {kpiItems}
          </section>
        ) : null}

        <section className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          <div className="space-y-4">
            {showAttentionBlock ? (
              <div className="rounded-2xl border border-slate-200 bg-[var(--enver-card)]/90 p-4 shadow-sm shadow-slate-900/5">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div>
                    <h2 className="text-sm font-semibold text-[var(--enver-text)]">
                      Що потребує уваги
                    </h2>
                    <p className="text-xs text-slate-500">
                      За вашими правами доступу: ліди, угоди та задачі в межах
                      видимості.
                    </p>
                  </div>
                </div>
                {snapshot.attention.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-3 py-4 text-xs text-slate-600">
                    Наразі без критичних сигналів у вашій зоні відповідальності.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {snapshot.attention.map((item) => {
                      const inner = (
                        <>
                          <div className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center">
                            <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                          </div>
                          <div className="min-w-0 space-y-0.5">
                            <p className="font-medium">{item.label}</p>
                            <p className="text-[11px] text-slate-500">
                              {item.detail}
                            </p>
                          </div>
                          <span className="ml-auto shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-amber-700">
                            {item.severity === "high"
                              ? "Високий ризик"
                              : "Увага"}
                          </span>
                        </>
                      );
                      const className =
                        "flex items-start gap-2 rounded-xl border border-amber-100 bg-amber-50/50 px-3 py-2 text-xs text-slate-800";
                      return item.href ? (
                        <Link
                          key={item.id}
                          href={item.href}
                          className={`${className} transition hover:border-amber-200 hover:bg-amber-50`}
                        >
                          {inner}
                        </Link>
                      ) : (
                        <div key={item.id} className={className}>
                          {inner}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : null}

            {showAgenda ? (
              <div className="rounded-2xl border border-slate-200 bg-[var(--enver-card)]/90 p-4 shadow-sm shadow-slate-900/5">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="text-sm font-semibold text-[var(--enver-text)]">
                      Сьогодні
                    </h2>
                    <p className="text-xs text-slate-500">
                      Події календаря у вашій зоні видимості.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                      <CalendarDays className="mr-1.5 h-3 w-3" />
                      {snapshot.agenda.length} подій
                    </span>
                    <Link
                      href="/calendar"
                      className="text-[11px] font-medium text-sky-700 underline-offset-2 hover:underline"
                    >
                      Відкрити календар
                    </Link>
                  </div>
                </div>
                {snapshot.agenda.length === 0 ? (
                  <p className="text-xs text-slate-500">
                    Немає подій на сьогодні.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {snapshot.agenda.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2 text-xs"
                      >
                        <div className="mt-0.5 shrink-0 text-[11px] font-medium text-slate-500">
                          {item.time}
                        </div>
                        <div className="min-w-0 space-y-0.5">
                          <p className="font-medium text-[var(--enver-text)]">
                            {item.label}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            {item.context}
                          </p>
                        </div>
                        <span
                          className={`ml-auto shrink-0 self-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] ${agendaTypeStyles[item.type]}`}
                        >
                          {agendaTypeLabel(item.type)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : null}
          </div>

          <div className="space-y-4">
            {showDealsCol ? (
              <div className="rounded-2xl border border-slate-200 bg-[var(--enver-card)]/90 p-4 shadow-sm shadow-slate-900/5">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="text-sm font-semibold text-[var(--enver-text)]">
                      Активні угоди
                    </h2>
                    <p className="text-xs text-slate-500">
                      Останні оновлені відкриті угоди у вашій видимості.
                    </p>
                  </div>
                  <Link
                    href="/deals"
                    className="text-[11px] font-medium text-sky-700 underline-offset-2 hover:underline"
                  >
                    Усі угоди
                  </Link>
                </div>
                {snapshot.deals.length === 0 ? (
                  <p className="text-xs text-slate-500">
                    Немає відкритих угод або немає доступу до списку.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {snapshot.deals.map((deal) => (
                      <Link
                        key={deal.id}
                        href={`/deals/${deal.id}/workspace`}
                        className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2 text-xs transition hover:border-slate-200 hover:bg-[var(--enver-hover)]"
                      >
                        <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[10px] font-semibold text-slate-50">
                          EN
                        </div>
                        <div className="min-w-0 space-y-0.5">
                          <p className="text-[13px] font-medium text-[var(--enver-text)]">
                            {deal.title}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            Стадія:{" "}
                            <span className="font-medium text-slate-700">
                              {deal.stage}
                            </span>{" "}
                            · Відповідальний: {deal.owner}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            {deal.dueLabel}
                          </p>
                        </div>
                        <div className="ml-auto shrink-0 self-center text-[11px] font-semibold text-[var(--enver-text)]">
                          {deal.valueLabel}
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ) : null}

            {showInbox ? (
              <div className="rounded-2xl border border-slate-200 bg-[var(--enver-card)]/90 p-4 shadow-sm shadow-slate-900/5">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div>
                    <h2 className="text-sm font-semibold text-[var(--enver-text)]">
                      Вхідні / повідомлення
                    </h2>
                    <p className="text-xs text-slate-500">
                      Є право перегляду сповіщень; єдиний потік повідомлень
                      зʼявиться після підключення каналів.
                    </p>
                  </div>
                  <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                    <Inbox className="mr-1.5 h-3 w-3" />
                    —
                  </span>
                </div>
                {nocPreview.length === 0 ? (
                  <div className="flex items-start gap-3 rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-3 py-3 text-xs text-slate-600">
                    <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-600">
                      <MessageCircle className="h-3.5 w-3.5" />
                    </div>
                    <div className="space-y-2">
                      <p>
                        Інтеграції месенджерів не підключені або дані ще не
                        синхронізовані. Після появи подій вони зʼявляться тут.
                      </p>
                      <Link
                        href="/inbox"
                        className="font-medium text-sky-700 underline-offset-2 hover:underline"
                      >
                        Відкрити «Вхідні»
                      </Link>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {nocPreview.map((a) => (
                      <Link
                        key={a.id}
                        href="/dashboard/critical"
                        className={`block rounded-xl border px-3 py-2 text-xs transition ${
                          a.readAt
                            ? "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100"
                            : "border-rose-200 bg-rose-50 text-rose-900 hover:bg-rose-100"
                        }`}
                      >
                        <p className="font-medium">
                          {a.channel} · {a.kind}
                        </p>
                        <p className="text-[11px]">{a.message}</p>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ) : null}

            {showHandoff ? (
              <div className="rounded-2xl border border-slate-200 bg-[var(--enver-card)]/90 p-4 shadow-sm shadow-slate-900/5">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div>
                    <h2 className="text-sm font-semibold text-[var(--enver-text)]">
                      Передача / виробництво
                    </h2>
                    <p className="text-xs text-slate-500">
                      Лічильники за угодами у вашій видимості та календарем
                      монтажів.
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {snapshot.handoffTiles.map((tile) => (
                    <div
                      key={tile.key}
                      className={`space-y-1 rounded-xl border px-3 py-2 ${handoffToneBorder[tile.tone]}`}
                    >
                      <p
                        className={`text-[11px] font-medium uppercase tracking-[0.16em] ${handoffToneLabel[tile.tone]}`}
                      >
                        {tile.label}
                      </p>
                      <p className="text-xl font-semibold text-[var(--enver-text)]">
                        {tile.value}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {tile.hint}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            {showDealsCol ? (
              <div className="rounded-2xl border border-slate-200 bg-[var(--enver-card)]/90 p-4 shadow-sm shadow-slate-900/5">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div>
                    <h2 className="text-sm font-semibold text-[var(--enver-text)]">
                      Підписи Дія: завислі
                    </h2>
                    <p className="text-xs text-slate-500">
                      Договори у статусі «Надіслано на підпис» понад 48 годин.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        snapshot.signatureStaleCount > 0
                          ? "bg-amber-100 text-amber-800"
                          : "bg-emerald-100 text-emerald-800"
                      }`}
                    >
                      {snapshot.signatureStaleCount}
                    </span>
                    <Link
                      href="/tasks/diia"
                      className="text-[11px] font-medium text-sky-700 underline-offset-2 hover:underline"
                    >
                      Відкрити чергу
                    </Link>
                  </div>
                </div>
                {snapshot.signatureStaleDeals.length === 0 ? (
                  <p className="text-xs text-slate-500">Завислих підписів немає.</p>
                ) : (
                  <div className="space-y-2">
                    {snapshot.signatureStaleDeals.map((d) => (
                      <Link
                        key={d.dealId}
                        href={`/deals/${d.dealId}/workspace?tab=contract`}
                        className="block rounded-xl border border-amber-100 bg-amber-50/60 px-3 py-2 text-xs transition hover:bg-amber-50"
                      >
                        <p className="font-medium text-[var(--enver-text)]">{d.title}</p>
                        <p className="text-[11px] text-amber-800">
                          Очікування підпису: {d.ageHours} год
                        </p>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </section>

        {showFunnel || showTeam ? (
          <section
            className={`grid gap-4 border-t border-slate-100 pt-4 ${
              showFunnel && showTeam
                ? "lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]"
                : ""
            }`}
          >
            {showFunnel ? (
              <div className="rounded-2xl border border-slate-200 bg-[var(--enver-card)]/90 p-4 shadow-sm shadow-slate-900/5">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div>
                    <h2 className="text-sm font-semibold text-[var(--enver-text)]">
                      Воронка лідів
                    </h2>
                    <p className="text-xs text-slate-500">
                      Розподіл за стадіями основної воронки (LEAD).
                    </p>
                  </div>
                  <Link
                    href="/leads/pipeline"
                    className="text-[11px] font-medium text-sky-700 underline-offset-2 hover:underline"
                  >
                    Воронка
                  </Link>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                  {snapshot.funnel.map((stage) => (
                    <div
                      key={stage.stageId}
                      className="flex min-w-0 flex-col justify-between rounded-xl border border-slate-100 bg-slate-50/70 px-2.5 py-2"
                    >
                      <p className="truncate text-[11px] font-medium text-slate-600">
                        {stage.name}
                      </p>
                      <p className="text-lg font-semibold text-[var(--enver-text)]">
                        {stage.count}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {stage.note}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {showTeam ? (
              <div className="rounded-2xl border border-slate-200 bg-[var(--enver-card)]/90 p-4 shadow-sm shadow-slate-900/5">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div>
                    <h2 className="text-sm font-semibold text-[var(--enver-text)]">
                      Навантаження команди
                    </h2>
                    <p className="text-xs text-slate-500">
                      Топ менеджерів за відкритими угодами та активними задачами
                      у межах вашої видимості (не для ролі «лише свої»).
                    </p>
                  </div>
                </div>
                <div className="space-y-2 text-xs">
                  {snapshot.teamLoad.map((member) => (
                    <div
                      key={member.userId}
                      className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2"
                    >
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[11px] font-semibold text-slate-50">
                        {member.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <p className="truncate text-[13px] font-medium text-[var(--enver-text)]">
                          {member.name}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          Угоди: {member.dealsOpen} · Задачі:{" "}
                          {member.tasksOpen}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-slate-50">
                        {teamStateLabel(
                          member.dealsOpen,
                          member.tasksOpen,
                        )}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-[11px] text-slate-100">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-300" />
                  <p>
                    Підказки з балансування навантаження зʼявляться, коли AI
                    матиме стабільний потік задач по команді.
                  </p>
                </div>
              </div>
            ) : null}
          </section>
        ) : null}
      </div>
    </main>
  );
}
