import type { DealWorkspacePayload, DealWorkspaceTabId } from "./types";
import { deriveDealPrimaryCta } from "./next-cta";
import {
  derivePaymentMoneySummaryForPayload,
  getEffectivePaymentMilestones,
} from "./payment-aggregate";

export type DealHealthLevel = "healthy" | "at_risk" | "blocked";
export type DealViewRole = "manager" | "constructor" | "production" | "admin";

export type DealHealthStatus = {
  level: DealHealthLevel;
  label: string;
  reason: string;
  reasonLabel: string;
};

export type DealPrimaryNextAction = {
  label: string;
  tab: DealWorkspaceTabId;
  reasons: string[];
  deadlineLabel: string | null;
  priority: "critical" | "high" | "normal";
  severity: "danger" | "warning" | "neutral";
};

export type DealCriticalBlocker = {
  id: string;
  title: string;
  description: string;
  severity: "critical";
  relatedModule: DealWorkspaceTabId;
  ctaLabel: string;
  stageImpact: string;
};

export type DealFinanceSummary = {
  total: number;
  paid: number;
  remaining: number;
  currency: string | null;
  hasNumeric: boolean;
  nextPaymentLabel: string;
  nextPaymentDueAtLabel: string | null;
};

export type DealPipelineStepState = {
  id: string;
  label: string;
  status: "done" | "current" | "blocked" | "locked";
  reason?: string;
  relatedTab: DealWorkspaceTabId;
  availableAction: string;
};

export type DealSmartInsight = {
  id: string;
  title: string;
  severity: "critical" | "warning" | "info";
  section: "critical" | "recommendations" | "readiness" | "history";
};

export type DealWarning = {
  id: string;
  title: string;
  relatedModule: DealWorkspaceTabId;
};

export type DealProductionReadiness = {
  done: number;
  total: number;
  ratio: number;
  label: string;
  missingItems: string[];
  isReady: boolean;
};

export type ProductionPackageStatus = {
  status: "incomplete" | "ready" | "review" | "accepted" | "returned";
  filesCount: number;
  drawingsCount: number;
  hasTechnicalAssignment: boolean;
  lastChangeLabel: string;
};

export type ConstructorWorkspaceState = {
  technicalReady: boolean;
  materialsReady: boolean;
  specificationReady: boolean;
  drawingsReady: boolean;
  filesReady: boolean;
  commentsCount: number;
  versionsCount: number;
};

const PIPELINE_STEPS: Array<{ id: string; label: string }> = [
  { id: "qualification", label: "Кваліфікація" },
  { id: "measurement", label: "Замір" },
  { id: "proposal", label: "КП" },
  { id: "contract", label: "Договір" },
  { id: "payment", label: "Оплата" },
  { id: "handoff", label: "Передача" },
  { id: "production", label: "Виробництво" },
  { id: "success", label: "Успіх" },
];

const PIPELINE_TAB_MAP: Record<string, DealWorkspaceTabId> = {
  qualification: "qualification",
  measurement: "measurement",
  proposal: "proposal",
  contract: "contract",
  payment: "payment",
  handoff: "handoff",
  production: "production",
  success: "activity",
};

function blockerTab(label: string): DealWorkspaceTabId {
  const n = label.toLowerCase();
  if (n.includes("догов")) return "contract";
  if (n.includes("оплат") || n.includes("аванс")) return "payment";
  if (n.includes("замір") || n.includes("розмір")) return "measurement";
  if (n.includes("кп")) return "proposal";
  if (n.includes("смет")) return "estimate";
  if (n.includes("файл") || n.includes("документ")) return "files";
  if (n.includes("задач")) return "tasks";
  if (n.includes("передач") || n.includes("вироб")) return "handoff";
  return "overview";
}

function blockerCta(tab: DealWorkspaceTabId): string {
  if (tab === "contract") return "Підписати договір";
  if (tab === "payment") return "Відкрити фінанси";
  if (tab === "measurement") return "Заповнити замір";
  if (tab === "files") return "Додати файли";
  if (tab === "tasks") return "Закрити задачі";
  if (tab === "proposal") return "Погодити КП";
  if (tab === "estimate") return "Погодити смету";
  if (tab === "handoff") return "Підготувати передачу";
  return "Виконати ключову дію";
}

function stageImpact(tab: DealWorkspaceTabId): string {
  if (tab === "contract") return "Блокує перехід до оплати";
  if (tab === "payment") return "Без підтвердження бухгалтерією передача у виробництво заблокована";
  if (tab === "measurement") return "Блокує формування коректного КП";
  if (tab === "proposal" || tab === "estimate") return "Гальмує підписання договору";
  if (tab === "files") return "Блокує повний пакет передачі";
  if (tab === "tasks") return "Ризик зупинки етапу";
  return "Впливає на швидкість проходження етапу";
}

function formatDeadline(value: string): string {
  const at = new Date(value);
  if (Number.isNaN(at.getTime())) return "Некоректний дедлайн";
  return at.toLocaleString("uk-UA", { dateStyle: "short", timeStyle: "short" });
}

function currentPipelineIndex(data: DealWorkspacePayload): number {
  if (data.deal.status === "WON") return PIPELINE_STEPS.length - 1;
  if (data.deal.status === "LOST") return Math.max(0, PIPELINE_STEPS.length - 2);
  const slug = data.stage.slug;
  if (slug.includes("qual")) return 0;
  if (slug.includes("measure")) return 1;
  if (slug.includes("proposal") || slug.includes("estimate")) return 2;
  if (slug.includes("contract")) return 3;
  if (slug.includes("payment") || slug.includes("finance")) return 4;
  if (slug.includes("handoff")) return 5;
  if (slug.includes("production")) return 6;
  return Math.max(0, Math.min(data.stage.sortOrder - 1, PIPELINE_STEPS.length - 2));
}

export function getDealViewRole(
  user: {
    effectiveRole?: string | null;
    realRole?: string | null;
    userId?: string | null;
    roleOverride?: DealViewRole | null;
  },
  deal: Pick<DealWorkspacePayload, "owner" | "productionManager" | "stage">,
): DealViewRole {
  if (user.roleOverride) return user.roleOverride;
  const effective = (user.effectiveRole ?? "").toUpperCase();
  const real = (user.realRole ?? "").toUpperCase();
  if (effective === "SUPER_ADMIN" || effective === "DIRECTOR") return "admin";
  if (
    (deal.productionManager?.id && user.userId && deal.productionManager.id === user.userId) ||
    effective.includes("PRODUCTION") ||
    real.includes("PRODUCTION")
  ) {
    return "production";
  }
  if (
    effective.includes("CONSTRUCTOR") ||
    real.includes("CONSTRUCTOR") ||
    deal.stage.slug.includes("handoff")
  ) {
    return "constructor";
  }
  return "manager";
}

export function getCriticalBlockers(
  data: DealWorkspacePayload,
  role: DealViewRole = "manager",
): DealCriticalBlocker[] {
  const readinessBlockers = data.readiness
    .filter((item) => !item.done)
    .map((item) => {
      const relatedModule = blockerTab(item.label);
      return {
        id: item.id,
        title: item.label,
        description: item.blockerMessage ?? "Потрібна дія менеджера для руху угоди далі.",
        severity: "critical" as const,
        relatedModule,
        ctaLabel: blockerCta(relatedModule),
        stageImpact: stageImpact(relatedModule),
      } satisfies DealCriticalBlocker;
    });
  const blockers = [...readinessBlockers];
  if (!data.meta.nextStepLabel?.trim() || !data.meta.nextActionAt) {
    blockers.unshift({
      id: "next-step-missing",
      title: "Не зафіксовано наступний крок",
      description: "Команда не має чіткого фокусу на поточний етап.",
      severity: "critical",
      relatedModule: "overview",
      ctaLabel: "Додати наступну дію",
      stageImpact: "Ризик втрати темпу по воронці",
    });
  }
  if (
    data.deal.status === "OPEN" &&
    data.operationalStats.overdueOpenTasksCount > 0
  ) {
    blockers.unshift({
      id: "overdue-tasks",
      title: `Прострочені задачі (${data.operationalStats.overdueOpenTasksCount})`,
      description: "Є незакриті дії з простроченим дедлайном.",
      severity: "critical",
      relatedModule: "tasks",
      ctaLabel: "Закрити прострочки",
      stageImpact: "Блокує контрольований рух угоди",
    });
  }
  const ranked = blockers.slice(0, 6).sort((a, b) => {
    const rankForRole = (item: DealCriticalBlocker): number => {
      if (role === "manager") {
        if (item.relatedModule === "contract" || item.relatedModule === "payment") return 0;
      }
      if (role === "constructor") {
        if (item.relatedModule === "measurement" || item.relatedModule === "files") return 0;
      }
      if (role === "production") {
        if (item.relatedModule === "handoff" || item.relatedModule === "production") return 0;
      }
      return 1;
    };
    return rankForRole(a) - rankForRole(b);
  });
  return ranked.slice(0, 3);
}

export function getWarnings(data: DealWorkspacePayload): DealWarning[] {
  const warnings: DealWarning[] = [];
  if (!data.deal.expectedCloseDate) {
    warnings.push({
      id: "no-close-date",
      title: "Не вказано очікувану дату закриття",
      relatedModule: "overview",
    });
  }
  if (!data.deal.value) {
    warnings.push({
      id: "no-value",
      title: "Сума угоди не зафіксована",
      relatedModule: "overview",
    });
  }
  if (!data.contract || data.contract.status === "DRAFT") {
    warnings.push({
      id: "contract-draft",
      title: "Договір ще в чернетці",
      relatedModule: "contract",
    });
  }
  return warnings.slice(0, 4);
}

export function getDealHealthStatus(
  data: DealWorkspacePayload,
  role: DealViewRole = "manager",
): DealHealthStatus {
  const blockers = getCriticalBlockers(data, role);
  if (blockers.length > 0) {
    const reason = blockers
      .map((item) => item.title)
      .slice(0, 2)
      .join(", ");
    return {
      level: "blocked",
      label: "Blocked",
      reason,
      reasonLabel: `Blocked: ${reason || "критичний блокер"}`,
    };
  }
  const staleWindowMs = 5 * 24 * 60 * 60 * 1000;
  const lastActivityMs = data.operationalStats.lastActivityAt
    ? new Date(data.operationalStats.lastActivityAt).getTime()
    : 0;
  const isStale = !lastActivityMs || Date.now() - lastActivityMs > staleWindowMs;

  if (
    data.deal.status === "ON_HOLD" ||
    data.operationalStats.overdueOpenTasksCount > 0 ||
    !data.meta.nextActionAt ||
    isStale
  ) {
    return {
      level: "at_risk",
      label: "At risk",
      reason: isStale
        ? "Низька активність по угоді останні дні."
        : "Є фактори, що можуть затримати проходження етапу.",
      reasonLabel: isStale ? "At risk: низька активність" : "At risk: потрібна увага",
    };
  }
  return {
    level: "healthy",
    label: "Healthy",
    reason: "Рух угоди контрольований, критичних ризиків не виявлено.",
    reasonLabel: "Healthy: угода рухається по плану",
  };
}

export function getDealHealthReason(
  data: DealWorkspacePayload,
  role: DealViewRole = "manager",
): string {
  return getDealHealthStatus(data, role).reasonLabel;
}

export function getPrimaryNextAction(
  data: DealWorkspacePayload,
  role: DealViewRole = "manager",
): DealPrimaryNextAction {
  const blockers = getCriticalBlockers(data, role);
  if (blockers.length > 0) {
    const main = blockers[0];
    return {
      label: main.ctaLabel,
      tab: main.relatedModule,
      reasons: blockers.map((item) => item.title).slice(0, 3),
      deadlineLabel: data.meta.nextActionAt ? formatDeadline(data.meta.nextActionAt) : null,
      priority: "critical",
      severity: "danger",
    };
  }
  const primary = deriveDealPrimaryCta(data);
  const normalizedLabel =
    primary.tab === "payment"
      ? "Перевірити підтвердження передоплати у фінансах"
      : primary.tab === "measurement"
        ? "Заповнити замір"
        : primary.tab === "contract"
          ? "Підписати договір"
          : primary.tab === "proposal"
            ? "Додати комерційну пропозицію"
            : primary.tab === "handoff"
              ? "Передати у виробництво"
              : primary.tab === "files"
                ? "Додати файли"
                : primary.label
                    .replace(/^Оновити\s+/i, "Додати ")
                    .replace(/^Зафіксувати\s+/i, "Підтвердити ");
  const roleLabelOverride =
    role === "constructor"
      ? data.readinessAllMet
        ? "Завершити ТЗ і передати у виробництво"
        : "Додати технічні дані"
      : role === "production"
        ? data.productionLaunch.status === "LAUNCHED"
          ? "Підтвердити запуск виробництва"
          : "Прийняти пакет у виробництво"
        : normalizedLabel;
  const reasons = [
    `Поточна стадія: ${data.stage.name}`,
    `Відкриті задачі: ${data.operationalStats.openTasksCount}`,
  ];
  if (data.meta.nextStepLabel?.trim()) {
    reasons.unshift(`План дії: ${data.meta.nextStepLabel.trim()}`);
  }
  return {
    label: roleLabelOverride,
    tab: primary.tab,
    reasons: reasons.slice(0, 3),
    deadlineLabel: data.meta.nextActionAt ? formatDeadline(data.meta.nextActionAt) : null,
    priority: "high",
    severity: data.meta.nextActionAt ? "neutral" : "warning",
  };
}

export function getFinanceSummary(data: DealWorkspacePayload): DealFinanceSummary {
  const money = derivePaymentMoneySummaryForPayload(data);
  const milestones = getEffectivePaymentMilestones(data);
  const nextOpen = milestones.find((item) => !item.done);
  const nextOpenWithDueAt = data.paymentMilestones
    .filter((item) => item.confirmedAt == null)
    .sort((a, b) => {
      const aTime = a.dueAt ? new Date(a.dueAt).getTime() : Number.POSITIVE_INFINITY;
      const bTime = b.dueAt ? new Date(b.dueAt).getTime() : Number.POSITIVE_INFINITY;
      return aTime - bTime;
    })[0];
  return {
    total: money.total,
    paid: money.paid,
    remaining: money.remaining,
    currency: money.currency,
    hasNumeric: money.hasNumeric,
    nextPaymentLabel: nextOpen
      ? `${nextOpen.label}${nextOpen.amount ? ` · ${nextOpen.amount.toLocaleString("uk-UA")} ${nextOpen.currency ?? money.currency ?? ""}` : ""}`
      : "Усі віхи оплати виконані",
    nextPaymentDueAtLabel: nextOpenWithDueAt?.dueAt
      ? new Date(nextOpenWithDueAt.dueAt).toLocaleDateString("uk-UA", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        })
      : null,
  };
}

export function getPipelineStageState(
  data: DealWorkspacePayload,
  role: DealViewRole = "manager",
): DealPipelineStepState[] {
  const current = currentPipelineIndex(data);
  const blocker = getCriticalBlockers(data, role)[0];
  return PIPELINE_STEPS.map((step, index) => {
    const relatedTab = PIPELINE_TAB_MAP[step.id] ?? "overview";
    const availableAction =
      index < current
        ? "Переглянути дані етапу"
        : index === current
          ? "Виконати поточну дію"
          : "Підготувати наступний етап";
    if (index < current) return { ...step, status: "done", relatedTab, availableAction };
    if (index > current) {
      const lockReason = blocker
        ? `Очікує: ${blocker.title.toLowerCase()}`
        : "Очікує завершення попереднього етапу";
      return {
        ...step,
        status: "locked",
        reason: lockReason,
        relatedTab,
        availableAction: blocker
          ? "Усунути блокер поточного етапу"
          : "Завершити поточний етап",
      };
    }
    if (data.deal.status === "WON") return { ...step, status: "done", relatedTab, availableAction };
    if (blocker) {
      return {
        ...step,
        status: "blocked",
        reason: blocker.title,
        relatedTab,
        availableAction: blocker.ctaLabel,
      };
    }
    return { ...step, status: "current", relatedTab, availableAction };
  });
}

export function getProductionReadiness(
  data: DealWorkspacePayload,
): DealProductionReadiness {
  const done = data.readiness.filter((item) => item.done).length;
  const total = data.readiness.length;
  const ratio = total > 0 ? done / total : 0;
  const missingItems = data.readiness
    .filter((item) => !item.done)
    .map((item) => item.label);
  const label =
    ratio === 1
      ? "Готово до передачі"
      : ratio >= 0.6
        ? "Потрібно закрити фінальні пункти"
        : "Недостатня готовність";
  return { done, total, ratio, label, missingItems, isReady: missingItems.length === 0 };
}

export function getProductionPackageStatus(
  data: DealWorkspacePayload,
): ProductionPackageStatus {
  const selectedIds = new Set(data.handoff.manifest.selectedAttachmentIds);
  const selectedFiles = data.attachments.filter((item) => selectedIds.has(item.id));
  const drawingsCount = selectedFiles.filter((item) => item.category === "DRAWING").length;
  const hasTechnicalAssignment = Boolean(data.handoff.notes?.trim());
  const status: ProductionPackageStatus["status"] =
    data.handoff.status === "ACCEPTED"
      ? "accepted"
      : data.handoff.status === "REJECTED"
        ? "returned"
        : data.handoff.status === "SUBMITTED"
          ? "review"
          : data.readinessAllMet
            ? "ready"
            : "incomplete";
  const lastChangeLabel = data.lastReadinessSnapshotAt
    ? new Date(data.lastReadinessSnapshotAt).toLocaleString("uk-UA", {
        dateStyle: "short",
        timeStyle: "short",
      })
    : "Ще не оновлювалось";
  return {
    status,
    filesCount: selectedFiles.length,
    drawingsCount,
    hasTechnicalAssignment,
    lastChangeLabel,
  };
}

export function getConstructorWorkspaceState(
  data: DealWorkspacePayload,
): ConstructorWorkspaceState {
  const selectedIds = new Set(data.handoff.manifest.selectedAttachmentIds);
  const selectedFiles = data.attachments.filter((item) => selectedIds.has(item.id));
  return {
    technicalReady: Boolean(data.controlMeasurement),
    materialsReady: Boolean(data.commercialSnapshot),
    specificationReady: Boolean(data.commercialSnapshot?.snapshotJson),
    drawingsReady: selectedFiles.some((item) => item.category === "DRAWING"),
    filesReady: selectedFiles.length > 0,
    commentsCount: data.constructorRoom?.messages.length ?? 0,
    versionsCount: data.attachments.length,
  };
}

export function getSmartInsights(
  data: DealWorkspacePayload,
  role: DealViewRole = "manager",
): DealSmartInsight[] {
  const insights: DealSmartInsight[] = [];
  insights.push({
    id: "critical-overdue",
    title:
      data.operationalStats.overdueOpenTasksCount > 0
        ? `Прострочені задачі: ${data.operationalStats.overdueOpenTasksCount}`
        : "Критичних сигналів поза blockers не виявлено",
    severity: data.operationalStats.overdueOpenTasksCount > 0 ? "critical" : "info",
    section: "critical",
  });
  const warnings = getWarnings(data);
  insights.push({
    id: "recommendation-main",
    title:
      role === "constructor"
        ? "Оновіть технічні дані перед передачею"
        : role === "production"
          ? "Перевірте комплект пакета перед запуском"
          : warnings[0]?.title ?? "Перевірте повноту ключових даних угоди",
    severity: warnings[0] ? "warning" : "info",
    section: "recommendations",
  });
  const readiness = getProductionReadiness(data);
  insights.push({
    id: "readiness",
    title: `${readiness.label} (${readiness.done}/${readiness.total})`,
    severity: "info",
    section: "readiness",
  });
  return insights.slice(0, 3);
}
