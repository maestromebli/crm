import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { P } from "@/lib/authz/permissions";
import {
  forbidUnlessPermission,
  requireSessionUser,
} from "@/lib/authz/api-guard";
import {
  REPORT_RANGES,
  REPORT_SECTIONS,
  type ReportChartPoint,
  type ReportPayload,
  type ReportRange,
  type ReportRow,
  type ReportSection,
} from "@/features/reports/types";

const DAY_MS = 24 * 60 * 60 * 1000;

type ReportCacheEntry = {
  expiresAt: number;
  value: ReportPayload;
};

const REPORTS_CACHE_TTL_MS = 30_000;
const REPORTS_CACHE_MAX_ENTRIES = 200;
const reportsCache = new Map<string, ReportCacheEntry>();

function reportCacheKey(args: {
  userId: string;
  section: ReportSection;
  range: ReportRange;
}): string {
  return `${args.userId}:${args.section}:${args.range}`;
}

function readReportCache(key: string): ReportPayload | null {
  const hit = reportsCache.get(key);
  if (!hit) return null;
  if (hit.expiresAt <= Date.now()) {
    reportsCache.delete(key);
    return null;
  }
  return hit.value;
}

function writeReportCache(key: string, value: ReportPayload): void {
  if (reportsCache.size >= REPORTS_CACHE_MAX_ENTRIES) {
    let oldestKey: string | null = null;
    let oldestExpiresAt = Number.POSITIVE_INFINITY;
    for (const [existingKey, existing] of reportsCache.entries()) {
      if (existing.expiresAt < oldestExpiresAt) {
        oldestExpiresAt = existing.expiresAt;
        oldestKey = existingKey;
      }
    }
    if (oldestKey) reportsCache.delete(oldestKey);
  }
  reportsCache.set(key, {
    value,
    expiresAt: Date.now() + REPORTS_CACHE_TTL_MS,
  });
}

function isReportSection(value: string): value is ReportSection {
  return REPORT_SECTIONS.includes(value as ReportSection);
}

function isReportRange(value: string): value is ReportRange {
  return REPORT_RANGES.includes(value as ReportRange);
}

function resolveRangeStart(range: ReportRange): Date {
  const now = Date.now();
  switch (range) {
    case "7d":
      return new Date(now - 7 * DAY_MS);
    case "30d":
      return new Date(now - 30 * DAY_MS);
    case "90d":
      return new Date(now - 90 * DAY_MS);
    default:
      return new Date(now - 30 * DAY_MS);
  }
}

function fmtInt(value: number): string {
  return value.toLocaleString("uk-UA");
}

function fmtMoney(value: number): string {
  return `${value.toLocaleString("uk-UA", {
    maximumFractionDigits: 0,
  })} ₴`;
}

function formatBucket(date: Date, range: ReportRange): string {
  if (range === "90d") {
    return date.toLocaleDateString("uk-UA", { day: "2-digit", month: "2-digit" });
  }
  return date.toLocaleDateString("uk-UA", { day: "2-digit", month: "2-digit" });
}

function buildDateChart(
  dates: Date[],
  range: ReportRange,
  maxPoints = 12,
): ReportChartPoint[] {
  const buckets = new Map<string, number>();
  for (const date of dates) {
    const key = formatBucket(date, range);
    buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }
  return [...buckets.entries()]
    .map(([label, value]) => ({ label, value }))
    .slice(-maxPoints);
}

function fallbackRow(message: string): ReportRow[] {
  return [
    {
      id: "empty",
      label: "Немає даних за період",
      primary: message,
    },
  ];
}

async function buildSalesReport(since: Date, range: ReportRange): Promise<ReportPayload> {
  const deals = await prisma.deal.findMany({
    where: { createdAt: { gte: since } },
    select: {
      id: true,
      title: true,
      status: true,
      value: true,
      createdAt: true,
      owner: { select: { name: true } },
    },
    orderBy: { createdAt: "asc" },
  });
  const wonDeals = deals.filter((deal) => deal.status === "WON");
  const openValue = deals
    .filter((deal) => deal.status === "OPEN")
    .reduce((acc, deal) => acc + Number(deal.value ?? 0), 0);
  const wonValue = wonDeals.reduce((acc, deal) => acc + Number(deal.value ?? 0), 0);
  const winRate = deals.length ? Math.round((wonDeals.length / deals.length) * 100) : 0;
  const avgCheck = wonDeals.length ? wonValue / wonDeals.length : 0;
  const rows = wonDeals
    .sort((a, b) => Number(b.value ?? 0) - Number(a.value ?? 0))
    .slice(0, 8)
    .map((deal) => ({
      id: deal.id,
      label: deal.title,
      primary: fmtMoney(Number(deal.value ?? 0)),
      secondary: deal.owner.name,
    }));

  return {
    section: "sales",
    range,
    generatedAt: new Date().toISOString(),
    title: "Звіт по продажах",
    subtitle: "Воронка замовлень, середній чек та закриття за період.",
    kpis: [
      { id: "deals", label: "Нові замовлення", value: fmtInt(deals.length) },
      { id: "won", label: "Виграні замовлення", value: fmtInt(wonDeals.length) },
      { id: "rate", label: "Win rate", value: `${winRate}%` },
      { id: "avg", label: "Середній чек", value: fmtMoney(avgCheck) },
      { id: "open", label: "Поточний open-pipeline", value: fmtMoney(openValue) },
    ],
    chart: buildDateChart(
      deals.map((deal) => deal.createdAt),
      range,
    ),
    rows: rows.length ? rows : fallbackRow("За обраний діапазон немає виграних замовлень"),
    highlights: [
      `Win rate за період: ${winRate}%.`,
      `Сума виграних замовлень: ${fmtMoney(wonValue)}.`,
      `Відкрити pipeline зараз: ${fmtMoney(openValue)}.`,
    ],
  };
}

async function buildConversionReport(
  since: Date,
  range: ReportRange,
): Promise<ReportPayload> {
  const leads = await prisma.lead.findMany({
    where: { createdAt: { gte: since } },
    select: {
      id: true,
      createdAt: true,
      dealId: true,
      stage: { select: { name: true } },
      owner: { select: { name: true } },
    },
    orderBy: { createdAt: "asc" },
  });
  const converted = leads.filter((lead) => lead.dealId);
  const conversionRate = leads.length
    ? Math.round((converted.length / leads.length) * 100)
    : 0;
  const stageCounter = new Map<string, number>();
  for (const lead of leads) {
    const key = lead.stage.name;
    stageCounter.set(key, (stageCounter.get(key) ?? 0) + 1);
  }
  const rows = [...stageCounter.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([label, count], index) => ({
      id: `${label}-${index}`,
      label,
      primary: `${fmtInt(count)} лідів`,
      secondary: leads.length ? `${Math.round((count / leads.length) * 100)}% бази` : undefined,
    }));
  const ownerCounter = new Map<string, number>();
  for (const lead of converted) {
    const key = lead.owner.name ?? "Без менеджера";
    ownerCounter.set(key, (ownerCounter.get(key) ?? 0) + 1);
  }
  const bestOwner = [...ownerCounter.entries()].sort((a, b) => b[1] - a[1])[0];

  return {
    section: "conversion",
    range,
    generatedAt: new Date().toISOString(),
    title: "Конверсія лідів",
    subtitle: "Динаміка створення лідів та переходу в замовлення.",
    kpis: [
      { id: "leads", label: "Нові ліди", value: fmtInt(leads.length) },
      { id: "converted", label: "Сконвертовано в замовлення", value: fmtInt(converted.length) },
      { id: "rate", label: "Конверсія", value: `${conversionRate}%` },
    ],
    chart: buildDateChart(
      leads.map((lead) => lead.createdAt),
      range,
    ),
    rows: rows.length ? rows : fallbackRow("За період ліди не створювалися"),
    highlights: [
      `Конверсія періоду: ${conversionRate}%.`,
      bestOwner
        ? `Найбільше конверсій у менеджера «${bestOwner[0]}»: ${bestOwner[1]}.`
        : "Поки немає конвертованих лідів для порівняння менеджерів.",
    ],
  };
}

async function buildTeamReport(since: Date, range: ReportRange): Promise<ReportPayload> {
  const now = new Date();
  const tasks = await prisma.task.findMany({
    where: { createdAt: { gte: since } },
    select: {
      id: true,
      status: true,
      dueAt: true,
      createdAt: true,
      assignee: { select: { name: true } },
    },
    orderBy: { createdAt: "asc" },
  });
  const byAssignee = new Map<
    string,
    { total: number; done: number; overdue: number; inProgress: number }
  >();
  for (const task of tasks) {
    const key = task.assignee.name ?? "Без виконавця";
    const current = byAssignee.get(key) ?? {
      total: 0,
      done: 0,
      overdue: 0,
      inProgress: 0,
    };
    current.total += 1;
    if (task.status === "DONE") current.done += 1;
    if (task.status === "IN_PROGRESS") current.inProgress += 1;
    if (task.dueAt && task.dueAt < now && task.status !== "DONE" && task.status !== "CANCELLED") {
      current.overdue += 1;
    }
    byAssignee.set(key, current);
  }
  const rows = [...byAssignee.entries()]
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 10)
    .map(([name, stat], index) => ({
      id: `${name}-${index}`,
      label: name,
      primary: `${fmtInt(stat.total)} задач`,
      secondary: `Done: ${stat.done}, In progress: ${stat.inProgress}, Прострочено: ${stat.overdue}`,
    }));
  const done = tasks.filter((task) => task.status === "DONE").length;
  const overdue = tasks.filter(
    (task) =>
      task.dueAt &&
      task.dueAt < now &&
      task.status !== "DONE" &&
      task.status !== "CANCELLED",
  ).length;
  return {
    section: "team",
    range,
    generatedAt: new Date().toISOString(),
    title: "Звіт по команді",
    subtitle: "Баланс навантаження по задачах та дисципліна виконання.",
    kpis: [
      { id: "all", label: "Задач за період", value: fmtInt(tasks.length) },
      { id: "done", label: "Виконано", value: fmtInt(done) },
      { id: "overdue", label: "Прострочено", value: fmtInt(overdue) },
      {
        id: "discipline",
        label: "Дисципліна",
        value: `${tasks.length ? Math.max(0, Math.round(((tasks.length - overdue) / tasks.length) * 100)) : 100}%`,
      },
    ],
    chart: [
      { label: "Open", value: tasks.filter((task) => task.status === "OPEN").length },
      { label: "In progress", value: tasks.filter((task) => task.status === "IN_PROGRESS").length },
      { label: "Done", value: done },
      { label: "Cancelled", value: tasks.filter((task) => task.status === "CANCELLED").length },
    ],
    rows: rows.length ? rows : fallbackRow("Задачі за період не знайдено"),
    highlights: [
      `Виконано ${done} із ${tasks.length} задач.`,
      `Прострочення становлять ${overdue} задач.`,
    ],
  };
}

async function buildLoadReport(since: Date, range: ReportRange): Promise<ReportPayload> {
  const tasks = await prisma.productionTask.findMany({
    where: { createdAt: { gte: since } },
    select: {
      id: true,
      type: true,
      status: true,
      dueDate: true,
      assigneeUser: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  const typeCounter = new Map<string, number>();
  const assigneeCounter = new Map<string, { total: number; blocked: number; done: number }>();
  for (const task of tasks) {
    const typeKey = task.type;
    typeCounter.set(typeKey, (typeCounter.get(typeKey) ?? 0) + 1);
    const assignee = task.assigneeUser?.name ?? "Без виконавця";
    const item = assigneeCounter.get(assignee) ?? { total: 0, blocked: 0, done: 0 };
    item.total += 1;
    if (task.status === "BLOCKED") item.blocked += 1;
    if (task.status === "DONE") item.done += 1;
    assigneeCounter.set(assignee, item);
  }
  const rows = [...assigneeCounter.entries()]
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 10)
    .map(([name, stat], index) => ({
      id: `${name}-${index}`,
      label: name,
      primary: `${fmtInt(stat.total)} задач`,
      secondary: `Done: ${stat.done}, Blocked: ${stat.blocked}`,
    }));

  return {
    section: "load",
    range,
    generatedAt: new Date().toISOString(),
    title: "Навантаження виробництва",
    subtitle: "Розподіл задач цеху/закупівель/монтажу за період.",
    kpis: [
      { id: "all", label: "Виробничих задач", value: fmtInt(tasks.length) },
      {
        id: "active",
        label: "Активні",
        value: fmtInt(tasks.filter((task) => task.status === "TODO" || task.status === "IN_PROGRESS").length),
      },
      { id: "blocked", label: "Blocked", value: fmtInt(tasks.filter((task) => task.status === "BLOCKED").length) },
      { id: "done", label: "Done", value: fmtInt(tasks.filter((task) => task.status === "DONE").length) },
    ],
    chart: [...typeCounter.entries()].map(([label, value]) => ({ label, value })),
    rows: rows.length ? rows : fallbackRow("Виробничі задачі за період не знайдено"),
    highlights: [
      `Активних задач: ${fmtInt(tasks.filter((task) => task.status === "TODO" || task.status === "IN_PROGRESS").length)}.`,
      `Заблокованих задач: ${fmtInt(tasks.filter((task) => task.status === "BLOCKED").length)}.`,
    ],
  };
}

async function buildInstallationsReport(
  since: Date,
  range: ReportRange,
): Promise<ReportPayload> {
  const now = new Date();
  const in7d = new Date(Date.now() + 7 * DAY_MS);
  const deals = await prisma.deal.findMany({
    where: { installationDate: { gte: since } },
    select: {
      id: true,
      title: true,
      status: true,
      installationDate: true,
      owner: { select: { name: true } },
      value: true,
    },
    orderBy: { installationDate: "asc" },
  });
  const planned = deals.filter((deal) => Boolean(deal.installationDate));
  const completed = planned.filter(
    (deal) => deal.status === "WON" && deal.installationDate && deal.installationDate <= now,
  );
  const next7 = planned.filter(
    (deal) => deal.installationDate && deal.installationDate >= now && deal.installationDate <= in7d,
  );
  const rows = planned.slice(0, 10).map((deal) => ({
    id: deal.id,
    label: deal.title,
    primary: deal.installationDate
      ? deal.installationDate.toLocaleDateString("uk-UA")
      : "Дата не визначена",
    secondary: `${deal.owner.name} · ${fmtMoney(Number(deal.value ?? 0))}`,
  }));
  return {
    section: "installations",
    range,
    generatedAt: new Date().toISOString(),
    title: "Монтажі",
    subtitle: "План/факт монтажів і найближчі вікна виконання.",
    kpis: [
      { id: "all", label: "Заплановано монтажів", value: fmtInt(planned.length) },
      { id: "next", label: "У найближчі 7 днів", value: fmtInt(next7.length) },
      { id: "done", label: "Закриті монтажі", value: fmtInt(completed.length) },
    ],
    chart: buildDateChart(
      planned
        .map((deal) => deal.installationDate)
        .filter((date): date is Date => Boolean(date)),
      range,
    ),
    rows: rows.length ? rows : fallbackRow("Монтажі за період не заплановані"),
    highlights: [
      `Найближчі 7 днів: ${fmtInt(next7.length)} монтажів.`,
      `Закрито монтажів: ${fmtInt(completed.length)}.`,
    ],
  };
}

async function buildSlaReport(since: Date, range: ReportRange): Promise<ReportPayload> {
  const now = new Date();
  const in24 = new Date(Date.now() + DAY_MS);
  const [tasks, leads] = await Promise.all([
    prisma.task.findMany({
      where: {
        dueAt: { not: null },
        createdAt: { gte: since },
      },
      select: {
        id: true,
        title: true,
        status: true,
        dueAt: true,
        assignee: { select: { name: true } },
      },
      orderBy: { dueAt: "asc" },
    }),
    prisma.lead.findMany({
      where: {
        nextContactAt: { not: null },
        createdAt: { gte: since },
      },
      select: {
        id: true,
        title: true,
        nextContactAt: true,
        owner: { select: { name: true } },
      },
      orderBy: { nextContactAt: "asc" },
    }),
  ]);

  const overdueTasks = tasks.filter(
    (task) => task.dueAt && task.dueAt < now && task.status !== "DONE" && task.status !== "CANCELLED",
  );
  const dueTodayTasks = tasks.filter(
    (task) => task.dueAt && task.dueAt >= now && task.dueAt <= in24 && task.status !== "DONE" && task.status !== "CANCELLED",
  );
  const overdueContacts = leads.filter((lead) => lead.nextContactAt && lead.nextContactAt < now);
  const rows: ReportRow[] = overdueTasks.slice(0, 8).map((task) => ({
    id: task.id,
    label: task.title,
    primary: task.dueAt ? task.dueAt.toLocaleDateString("uk-UA") : "Без дати",
    secondary: task.assignee.name,
  }));

  const sla = tasks.length
    ? Math.max(0, Math.round(((tasks.length - overdueTasks.length) / tasks.length) * 100))
    : 100;

  return {
    section: "sla",
    range,
    generatedAt: new Date().toISOString(),
    title: "SLA відповіді",
    subtitle: "Контроль прострочень по задачах і наступних контактах.",
    kpis: [
      { id: "sla", label: "Поточний SLA", value: `${sla}%` },
      { id: "overdueTasks", label: "Прострочені задачі", value: fmtInt(overdueTasks.length) },
      { id: "dueSoon", label: "До дедлайну < 24г", value: fmtInt(dueTodayTasks.length) },
      { id: "overdueLeads", label: "Прострочені контакти", value: fmtInt(overdueContacts.length) },
    ],
    chart: [
      { label: "Прострочені задачі", value: overdueTasks.length },
      { label: "Сьогодні", value: dueTodayTasks.length },
      { label: "Прострочені контакти", value: overdueContacts.length },
    ],
    rows: rows.length ? rows : fallbackRow("Прострочених задач не знайдено"),
    highlights: [
      `SLA станом на зараз: ${sla}%.`,
      `Прострочених наступних контактів: ${fmtInt(overdueContacts.length)}.`,
    ],
  };
}

async function buildFilesReport(since: Date, range: ReportRange): Promise<ReportPayload> {
  const [dealFiles, deals] = await Promise.all([
    prisma.dealFileLink.findMany({
      where: { createdAt: { gte: since } },
      select: { id: true, category: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.deal.findMany({
      where: { createdAt: { gte: since } },
      select: {
        id: true,
        title: true,
        _count: { select: { fileLinks: true } },
      },
    }),
  ]);
  const withFiles = deals.filter((deal) => deal._count.fileLinks > 0);
  const coverage = deals.length ? Math.round((withFiles.length / deals.length) * 100) : 0;
  const byCategory = new Map<string, number>();
  for (const file of dealFiles) {
    const key = file.category || "Без категорії";
    byCategory.set(key, (byCategory.get(key) ?? 0) + 1);
  }
  const rows = [...byCategory.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([category, count], index) => ({
      id: `${category}-${index}`,
      label: category,
      primary: `${fmtInt(count)} файлів`,
      secondary: dealFiles.length
        ? `${Math.round((count / dealFiles.length) * 100)}% від усіх`
        : undefined,
    }));

  return {
    section: "files",
    range,
    generatedAt: new Date().toISOString(),
    title: "Заповненість файлів",
    subtitle: "Покриття замовлень документами та структура категорій.",
    kpis: [
      { id: "files", label: "Файлів за період", value: fmtInt(dealFiles.length) },
      { id: "deals", label: "Замовлень у періоді", value: fmtInt(deals.length) },
      { id: "coverage", label: "Покриття замовлень файлами", value: `${coverage}%` },
    ],
    chart: [...byCategory.entries()].map(([label, value]) => ({ label, value })),
    rows: rows.length ? rows : fallbackRow("Нові файли за період не додавалися"),
    highlights: [
      `Покриття замовлень файлами: ${coverage}%.`,
      `Категорій з активністю: ${fmtInt(byCategory.size)}.`,
    ],
  };
}

async function buildCustomReport(since: Date, range: ReportRange): Promise<ReportPayload> {
  const [leads, deals, tasks] = await Promise.all([
    prisma.lead.count({ where: { createdAt: { gte: since } } }),
    prisma.deal.count({ where: { createdAt: { gte: since } } }),
    prisma.task.count({ where: { createdAt: { gte: since } } }),
  ]);

  return {
    section: "custom",
    range,
    generatedAt: new Date().toISOString(),
    title: "Кастомні звіти",
    subtitle: "Шаблони для швидкого створення власних вʼю під роль.",
    kpis: [
      { id: "leads", label: "Ліди у діапазоні", value: fmtInt(leads) },
      { id: "deals", label: "Замовлення у діапазоні", value: fmtInt(deals) },
      { id: "tasks", label: "Задачі у діапазоні", value: fmtInt(tasks) },
    ],
    chart: [
      { label: "Ліди", value: leads },
      { label: "Замовлення", value: deals },
      { label: "Задачі", value: tasks },
    ],
    rows: [
      {
        id: "custom-1",
        label: "План/факт продажів по менеджерах",
        primary: "Порівняння в розрізі owner + pipeline",
        secondary: "База для executive-звіту за місяць",
      },
      {
        id: "custom-2",
        label: "SLA по воронці лідів",
        primary: "Ліди з nextContactAt та простроченням",
        secondary: "Операційний контроль продажів",
      },
      {
        id: "custom-3",
        label: "Навантаження production vs procurement",
        primary: "ProductionTask по type/status",
        secondary: "Баланс ресурсів між командами",
      },
    ],
    highlights: [
      "Кастомні вʼю будуються з поточного набору джерел CRM.",
      "Поточний екран можна експортувати в CSV для подальшої обробки.",
    ],
  };
}

async function buildReport(
  section: ReportSection,
  since: Date,
  range: ReportRange,
): Promise<ReportPayload> {
  switch (section) {
    case "sales":
      return buildSalesReport(since, range);
    case "conversion":
      return buildConversionReport(since, range);
    case "team":
      return buildTeamReport(since, range);
    case "load":
      return buildLoadReport(since, range);
    case "installations":
      return buildInstallationsReport(since, range);
    case "sla":
      return buildSlaReport(since, range);
    case "files":
      return buildFilesReport(since, range);
    case "custom":
      return buildCustomReport(since, range);
    default:
      return buildSalesReport(since, range);
  }
}

export async function GET(request: Request) {
  if (!process.env.DATABASE_URL?.trim()) {
    return NextResponse.json({ error: "DATABASE_URL не задано" }, { status: 503 });
  }
  try {
    const user = await requireSessionUser();
    if (user instanceof NextResponse) return user;
    const denied = forbidUnlessPermission(user, P.REPORTS_VIEW);
    if (denied) return denied;

    const { searchParams } = new URL(request.url);
    const rawSection = searchParams.get("section") ?? "sales";
    const rawRange = searchParams.get("range") ?? "30d";
    const section = isReportSection(rawSection) ? rawSection : "sales";
    const range = isReportRange(rawRange) ? rawRange : "30d";
    const cacheKey = reportCacheKey({ userId: user.id, section, range });
    const cached = readReportCache(cacheKey);
    if (cached) return NextResponse.json(cached);
    const since = resolveRangeStart(range);

    const payload = await buildReport(section, since, range);
    writeReportCache(cacheKey, payload);
    return NextResponse.json(payload);
  } catch (error) {
    console.error("[api/reports]", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Помилка формування звіту",
      },
      { status: 500 },
    );
  }
}
