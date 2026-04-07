import type {
  DealWorkspaceMeta,
  DealWorkspacePayload,
  DealWorkspaceTabId,
} from "./types";
import type {
  PaymentMoneySummary,
  PaymentStripSummary,
} from "@/lib/deal-core/summary-types";
import { deriveNextStepSeverity } from "@/lib/deal-core/insights";
import { derivePaymentStripSummaryForPayload } from "@/lib/deal-core/payment-aggregate";

export type WarningLevel = "critical" | "warning" | "info";

export type DealWarningItem = {
  level: WarningLevel;
  key: string;
  message: string;
};

export type { PaymentStripSummary, PaymentMoneySummary };

export function derivePaymentMoneySummary(
  meta: DealWorkspaceMeta,
  dealCurrency: string | null,
): PaymentMoneySummary {
  const ms = meta.payment?.milestones ?? [];
  if (ms.length === 0) {
    return {
      hasNumeric: false,
      total: 0,
      paid: 0,
      remaining: 0,
      currency: dealCurrency,
    };
  }
  let total = 0;
  let paid = 0;
  let c = dealCurrency ?? ms[0]?.currency ?? null;
  let hasNumericAmount = false;
  for (const m of ms) {
    if (m.amount != null && m.amount > 0) hasNumericAmount = true;
    const a = m.amount ?? 0;
    total += a;
    if (m.done) paid += a;
    if (m.currency?.trim()) c = m.currency.trim();
  }
  return {
    hasNumeric: hasNumericAmount,
    total,
    paid,
    remaining: Math.max(0, total - paid),
    currency: c,
  };
}

const INACTIVITY_DAYS = 5;
const STALE_DEAL_DAYS = 14;

function sameCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function derivePaymentStripSummary(
  meta: DealWorkspaceMeta,
): PaymentStripSummary {
  const ms = meta.payment?.milestones ?? [];
  if (ms.length === 0) {
    return {
      done: 0,
      total: 0,
      label: "Оплата: віхи не задані",
      variant: "empty",
    };
  }
  const done = ms.filter((m) => m.done).length;
  const total = ms.length;
  if (done === 0) {
    return {
      done,
      total,
      label: `Оплата: 0 / ${total} віх`,
      variant: "unpaid",
    };
  }
  if (done === total) {
    return {
      done,
      total,
      label: `Оплата: всі віхи (${total})`,
      variant: "complete",
    };
  }
  return {
    done,
    total,
    label: `Оплата: ${done} / ${total} віх`,
    variant: "partial",
  };
}

export function deriveDealWarnings(data: DealWorkspacePayload): DealWarningItem[] {
  const items: DealWarningItem[] = [];
  const step = deriveNextStepSeverity(data.meta);

  if (step === "danger") {
    items.push({
      level: "critical",
      key: "no_next_step",
      message: "Немає наступного кроку або дати контакту.",
    });
  } else if (step === "warning") {
    items.push({
      level: "warning",
      key: "next_step_overdue",
      message: "Дата наступної дії прострочена — оновіть або зафіксуйте результат.",
    });
  }

  if (data.operationalStats.overdueOpenTasksCount > 0) {
    items.push({
      level: "critical",
      key: "overdue_tasks",
      message: `Є прострочені відкриті задачі (${data.operationalStats.overdueOpenTasksCount}).`,
    });
  }

  const lastAt = data.operationalStats.lastActivityAt
    ? new Date(data.operationalStats.lastActivityAt)
    : null;
  if (
    lastAt &&
    !Number.isNaN(lastAt.getTime()) &&
    data.deal.status === "OPEN"
  ) {
    const days = (Date.now() - lastAt.getTime()) / 86_400_000;
    if (days >= INACTIVITY_DAYS) {
      items.push({
        level: "warning",
        key: "inactive",
        message: `Довго без подій у журналі (${Math.floor(days)} дн.) — варто вийти на контакт.`,
      });
    }
  }

  if (data.deal.status === "OPEN" && data.operationalStats.estimatesCount === 0) {
    items.push({
      level: "warning",
      key: "no_estimate",
      message: "Немає прорахунку (смети) по угоді.",
    });
  }

  const slug = data.stage.slug;
  if (
    data.deal.status === "OPEN" &&
    !data.meta.proposalSent &&
    (slug === "proposal" || slug === "contract" || slug === "payment")
  ) {
    items.push({
      level: "warning",
      key: "no_quote",
      message: "КП не позначено як надіслане — уточніть статус з клієнтом.",
    });
  }

  if (
    data.deal.status === "OPEN" &&
    !data.contract &&
    ["contract", "payment", "handoff", "production"].includes(slug)
  ) {
    items.push({
      level: "warning",
      key: "no_contract",
      message: "На цій стадії очікується договір — створіть чернетку.",
    });
  }

  const upd = new Date(data.deal.updatedAt);
  const staleDays = (Date.now() - upd.getTime()) / 86_400_000;
  if (staleDays >= STALE_DEAL_DAYS && data.deal.status === "OPEN") {
    items.push({
      level: "warning",
      key: "stale_deal",
      message: "Угода давно не оновлювалась — перевірте актуальність.",
    });
  }

  if (
    data.deal.status === "OPEN" &&
    data.operationalStats.openTasksCount === 0 &&
    step !== "danger"
  ) {
    items.push({
      level: "info",
      key: "no_open_tasks",
      message: "Немає відкритих задач — переконайтесь, що наступний крок у календарі.",
    });
  }

  return items;
}

export function deriveReadinessStripState(data: DealWorkspacePayload) {
  const pay = derivePaymentStripSummaryForPayload(data);
  return {
    contact: Boolean(
      data.primaryContact?.phone?.trim() || data.primaryContact?.email?.trim(),
    ),
    qualification: Boolean(data.meta.qualificationComplete),
    estimate: data.operationalStats.estimatesCount > 0,
    quote: Boolean(data.meta.proposalSent),
    contract: Boolean(data.contract),
    payment: pay.done > 0,
    paymentComplete: pay.variant === "complete",
  };
}

export type AssistantCard = {
  id: string;
  tone: "neutral" | "amber" | "rose" | "sky";
  title: string;
  body: string;
  ctaTab?: DealWorkspaceTabId;
  ctaLabel?: string;
};

export function deriveAssistantCards(data: DealWorkspacePayload): AssistantCard[] {
  const cards: AssistantCard[] = [];
  const step = deriveNextStepSeverity(data.meta);

  const exec = data.meta.executionChecklist;
  if (exec && data.deal.status === "OPEN") {
    const keys = [
      "contactConfirmed",
      "estimateApproved",
      "contractCreated",
      "contractSigned",
      "prepaymentReceived",
      "productionStarted",
      "installationScheduled",
    ] as const;
    const missing = keys.filter((k) => !exec[k]).length;
    if (missing > 0) {
      cards.push({
        id: "assist_exec_checklist",
        tone: "amber",
        title: `Чеклист виконання: ${missing} з ${keys.length}`,
        body: "Позначте виконані етапи в блоці «Виконання» на огляді.",
        ctaTab: "overview",
        ctaLabel: "До чеклисту",
      });
    }
  }

  const payStrip = derivePaymentStripSummaryForPayload(data);
  if (
    data.deal.status === "OPEN" &&
    payStrip.total > 0 &&
    payStrip.variant === "unpaid"
  ) {
    cards.push({
      id: "assist_payment_unpaid",
      tone: "rose",
      title: "Оплата не підтверджена",
      body: "Є віхи оплати, але жодна не відмічена як отримана — перевірте графік.",
      ctaTab: "payment",
      ctaLabel: "Оплата",
    });
  }

  if (
    data.contract &&
    data.deal.status === "OPEN" &&
    data.contract.status !== "FULLY_SIGNED"
  ) {
    cards.push({
      id: "assist_contract_not_signed",
      tone: "amber",
      title: "Договір без повного підпису",
      body: `Поточний статус: ${data.contract.status}. Завершіть підпис або оновіть статус.`,
      ctaTab: "contract",
      ctaLabel: "Договір",
    });
  }

  if (step === "danger") {
    cards.push({
      id: "assist_no_next",
      tone: "rose",
      title: "Немає наступного кроку",
      body: "Вкажіть конкретну дію та дату — це видно керівнику в списках проблемних угод.",
      ctaLabel: "Запланувати",
    });
  }

  if (data.operationalStats.overdueOpenTasksCount > 0) {
    cards.push({
      id: "assist_overdue_tasks",
      tone: "rose",
      title: "Прострочені задачі",
      body: "Закрийте або перенесіть дедлайн, щоб зняти ризик.",
      ctaTab: "tasks",
      ctaLabel: "До задач",
    });
  }

  if (
    data.meta.nextStepKind === "payment" &&
    data.meta.nextActionAt &&
    data.deal.status === "OPEN"
  ) {
    const d = new Date(data.meta.nextActionAt);
    if (!Number.isNaN(d.getTime()) && sameCalendarDay(d, new Date())) {
      cards.push({
        id: "assist_payment_today",
        tone: "amber",
        title: "Сьогодні — контакт по оплаті",
        body: "Перевірте віхи та зафіксуйте результат у блоці оплати.",
        ctaTab: "payment",
        ctaLabel: "Оплата",
      });
    }
  }

  if (data.operationalStats.estimatesCount > 0 && step === "ok" && !data.meta.proposalSent) {
    cards.push({
      id: "assist_quote_followup",
      tone: "sky",
      title: "Є прорахунок — наступний крок?",
      body: "Після смети зазвичай потрібен контакт або відправка КП.",
      ctaTab: "proposal",
      ctaLabel: "КП",
    });
  }

  const lastAt = data.operationalStats.lastActivityAt
    ? new Date(data.operationalStats.lastActivityAt)
    : null;
  if (
    lastAt &&
    !Number.isNaN(lastAt.getTime()) &&
    data.deal.status === "OPEN"
  ) {
    const days = (Date.now() - lastAt.getTime()) / 86_400_000;
    if (days >= INACTIVITY_DAYS) {
      cards.push({
        id: "assist_silent",
        tone: "amber",
        title: `Тихо вже ${Math.floor(days)} дн.`,
        body: "Додайте дзвінок, нотатку або задачу — оновіть журнал активності.",
        ctaTab: "activity",
        ctaLabel: "Журнал",
      });
    }
  }

  if (
    data.deal.status === "OPEN" &&
    ["contract", "payment"].includes(data.stage.slug) &&
    !data.contract
  ) {
    cards.push({
      id: "assist_contract_missing",
      tone: "amber",
      title: "Договір ще не створено",
      body: "На пізніх стадіях без договору втрачається контроль підпису та оплати.",
      ctaTab: "contract",
      ctaLabel: "Договір",
    });
  }

  const seen = new Set<string>();
  return cards.filter((c) => {
    if (seen.has(c.id)) return false;
    seen.add(c.id);
    return true;
  }).slice(0, 4);
}

export type ListWarningBadge = "critical" | "warning" | null;

/** Короткі операційні сигнали для правої колонки угоди (додатково до основної рекомендації). */
export function deriveDealRailMicroHints(
  data: DealWorkspacePayload,
): string[] {
  const hints: string[] = [];
  if (data.operationalStats.overdueOpenTasksCount > 0) {
    hints.push(
      `Прострочені відкриті задачі: ${data.operationalStats.overdueOpenTasksCount}`,
    );
  }
  const pay = derivePaymentStripSummaryForPayload(data);
  if (pay.variant === "unpaid" && pay.total > 0) {
    hints.push("Є незакриті віхи оплати — перевірте надходження.");
  } else if (pay.variant === "partial") {
    hints.push(`Оплата: ${pay.label}`);
  }
  const c = data.contract?.status;
  if (
    c === "SENT_FOR_SIGNATURE" ||
    c === "VIEWED_BY_CLIENT" ||
    c === "CLIENT_SIGNED"
  ) {
    hints.push("Договір у циклі підпису — контролюйте дедлайн клієнта.");
  }
  if (!data.leadId && data.deal.status === "OPEN") {
    hints.push(
      "Немає привʼязаного ліда — історія до угоди може бути неповна.",
    );
  }
  return hints.slice(0, 4);
}

/** Легка евристика для рядка списку угод (без завантаження задач по кожній угоді). */
export function deriveDealListWarningBadge(input: {
  status: string;
  nextStepLabel: string | null;
  nextActionAt: string | null;
  updatedAt: Date;
  estimatesCount: number;
}): ListWarningBadge {
  if (input.status !== "OPEN") return null;
  const hasNext =
    Boolean(input.nextStepLabel?.trim()) && Boolean(input.nextActionAt);
  if (!hasNext) return "critical";
  const at = input.nextActionAt ? new Date(input.nextActionAt) : null;
  if (at && !Number.isNaN(at.getTime()) && at.getTime() < Date.now()) {
    return "critical";
  }
  const staleDays =
    (Date.now() - input.updatedAt.getTime()) / 86_400_000;
  if (staleDays >= STALE_DEAL_DAYS) return "warning";
  if (input.estimatesCount === 0) return "warning";
  return null;
}
