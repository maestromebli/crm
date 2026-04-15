import type { ProductionCommandCenterView, ProductionFlowStatus, ProductionQueueItem } from "../../types/production";

export type DeadlineRiskState = "safe" | "due_soon" | "due_today" | "overdue" | "will_miss_promise";
export type WorkshopLoadState = "underloaded" | "balanced" | "near_capacity" | "overloaded" | "blocked";
export type OperationalState =
  | "not_ready"
  | "queued"
  | "scheduled"
  | "ready_to_start"
  | "in_production"
  | "waiting_dependency"
  | "blocked"
  | "at_risk"
  | "overdue"
  | "completed";

const OPERATIONAL_LABELS: Record<OperationalState, string> = {
  not_ready: "Не готово",
  queued: "У черзі",
  scheduled: "Заплановано",
  ready_to_start: "Готово до старту",
  in_production: "У виробництві",
  waiting_dependency: "Очікує залежність",
  blocked: "Заблоковано",
  at_risk: "Під ризиком",
  overdue: "Прострочено",
  completed: "Завершено",
};

function dayDiff(iso: string | null, nowMs = Date.now()): number | null {
  if (!iso) return null;
  const dueTime = new Date(iso).getTime();
  if (Number.isNaN(dueTime)) return null;
  return Math.ceil((dueTime - nowMs) / (24 * 60 * 60 * 1000));
}

function isCompletedStatus(status: ProductionFlowStatus): boolean {
  return status === "DONE" || status === "CANCELLED";
}

export function getDeadlineRiskState(
  order: Pick<ProductionQueueItem, "dueDate" | "riskScore" | "readinessPercent" | "status">,
): DeadlineRiskState {
  const diff = dayDiff(order.dueDate);
  if (diff === null) return order.riskScore >= 80 ? "will_miss_promise" : "safe";
  if (diff < 0) return "overdue";
  if (diff === 0) return order.riskScore >= 80 ? "will_miss_promise" : "due_today";
  if (diff <= 2 && order.riskScore >= 70) return "will_miss_promise";
  if (diff <= 3) return "due_soon";
  return "safe";
}

export function getProductionOrderOperationalState(
  order: Pick<ProductionQueueItem, "status" | "readinessPercent" | "blockersCount" | "riskScore" | "dueDate">,
): { key: OperationalState; label: string } {
  const dueRisk = getDeadlineRiskState(order);
  if (isCompletedStatus(order.status)) return { key: "completed", label: OPERATIONAL_LABELS.completed };
  if (dueRisk === "overdue") return { key: "overdue", label: OPERATIONAL_LABELS.overdue };
  if (order.status === "BLOCKED" || order.blockersCount > 0) return { key: "blocked", label: OPERATIONAL_LABELS.blocked };
  if (order.status === "ON_HOLD") return { key: "waiting_dependency", label: OPERATIONAL_LABELS.waiting_dependency };
  if (order.status === "IN_WORKSHOP") return { key: "in_production", label: OPERATIONAL_LABELS.in_production };
  if (order.readinessPercent < 35) return { key: "not_ready", label: OPERATIONAL_LABELS.not_ready };
  if (order.status === "READY_FOR_PROCUREMENT_AND_WORKSHOP") return { key: "scheduled", label: OPERATIONAL_LABELS.scheduled };
  if (order.readinessPercent >= 80 && order.status === "ACTIVE") return { key: "ready_to_start", label: OPERATIONAL_LABELS.ready_to_start };
  if (order.riskScore >= 70 || dueRisk === "will_miss_promise") return { key: "at_risk", label: OPERATIONAL_LABELS.at_risk };
  return { key: "queued", label: OPERATIONAL_LABELS.queued };
}

export function getPlanningPriorityReason(
  order: Pick<ProductionQueueItem, "riskScore" | "blockersCount" | "dueDate" | "readinessPercent" | "status">,
): { code: string; label: string } {
  const dueRisk = getDeadlineRiskState(order);
  if (dueRisk === "overdue" || dueRisk === "due_today") return { code: "urgent_due_date", label: "Критичний дедлайн" };
  if (order.blockersCount > 0) return { code: "blocked_but_reserved", label: "Заблоковано, але зарезервовано" };
  if (order.status === "ON_HOLD") return { code: "manual_override", label: "Ручне втручання" };
  if (order.riskScore >= 80) return { code: "replan_after_delay", label: "Перепланування після затримки" };
  if (order.readinessPercent >= 80) return { code: "material_ready", label: "Матеріали готові" };
  return { code: "dependency_cleared", label: "Залежність знята" };
}

export function getWorkshopLoadState(
  workshop: { loadPercent: number; waitingCount?: number },
): { key: WorkshopLoadState; label: string } {
  if (workshop.loadPercent <= 0 && (workshop.waitingCount ?? 0) > 0) return { key: "blocked", label: "Заблоковано" };
  if (workshop.loadPercent >= 95) return { key: "overloaded", label: "Перевантажено" };
  if (workshop.loadPercent >= 85) return { key: "near_capacity", label: "Близько до межі" };
  if (workshop.loadPercent >= 45) return { key: "balanced", label: "Збалансовано" };
  return { key: "underloaded", label: "Недозавантажено" };
}

export function getCapacitySummary(planningData: ProductionCommandCenterView) {
  const byState = planningData.stationLoads.reduce(
    (acc, station) => {
      const key = getWorkshopLoadState(station).key;
      acc[key] += 1;
      return acc;
    },
    {
      underloaded: 0,
      balanced: 0,
      near_capacity: 0,
      overloaded: 0,
      blocked: 0,
    } satisfies Record<WorkshopLoadState, number>,
  );

  const allocatedLoad = planningData.stationLoads.reduce((sum, station) => sum + station.loadPercent, 0);
  const utilization = planningData.stationLoads.length > 0 ? Math.round(allocatedLoad / planningData.stationLoads.length) : 0;
  const overdueItemsCount = planningData.queue.filter((order) => getDeadlineRiskState(order) === "overdue").length;
  const atRiskItemsCount = planningData.queue.filter((order) => getProductionOrderOperationalState(order).key === "at_risk").length;
  const nextAvailable = [...planningData.stationLoads].sort((a, b) => a.loadPercent - b.loadPercent)[0];

  return {
    capacity: planningData.stationLoads.length * 100,
    allocatedLoad,
    utilization,
    overdueItemsCount,
    atRiskItemsCount,
    nextAvailableSlot: nextAvailable ? `${nextAvailable.stationLabel} (${100 - nextAvailable.loadPercent}% вільно)` : "Слот відсутній",
    byState,
  };
}

export function getQueueHealthSummary(queue: ProductionQueueItem[]) {
  const operational = queue.map((order) => getProductionOrderOperationalState(order).key);
  const overdue = operational.filter((state) => state === "overdue").length;
  const blocked = operational.filter((state) => state === "blocked").length;
  const atRisk = operational.filter((state) => state === "at_risk").length;
  const inProduction = operational.filter((state) => state === "in_production").length;
  const readyToStart = operational.filter((state) => state === "ready_to_start").length;
  const queued = operational.filter((state) => state === "queued" || state === "scheduled").length;
  const notReady = operational.filter((state) => state === "not_ready").length;
  const pressure = overdue * 5 + blocked * 4 + atRisk * 3 + notReady * 2 + queued;
  const maxPressure = Math.max(1, queue.length * 6);
  const healthScore = Math.max(0, Math.min(100, Math.round(100 - (pressure / maxPressure) * 100)));

  return { total: queue.length, overdue, blocked, atRisk, inProduction, readyToStart, queued, notReady, healthScore };
}

export function getPlanningInsights(planningData: ProductionCommandCenterView) {
  const capacity = getCapacitySummary(planningData);
  const queueHealth = getQueueHealthSummary(planningData.queue);
  const criticalOverdue = queueHealth.overdue;
  const blockedOrders = queueHealth.blocked;
  const overloadedWorkshops = capacity.byState.overloaded;
  const idleCapacity = capacity.byState.underloaded;
  const replanCandidates = planningData.queue.filter((order) => {
    const dueState = getDeadlineRiskState(order);
    return dueState === "will_miss_promise" || getProductionOrderOperationalState(order).key === "at_risk";
  }).length;
  const todayStarts = planningData.queue.filter((order) => getDeadlineRiskState(order) === "due_today").length;
  const todayFinishes = planningData.queue.filter((order) => getProductionOrderOperationalState(order).key === "in_production").length;

  return {
    criticalOverdue,
    blockedOrders,
    overloadedWorkshops,
    idleCapacity,
    replanCandidates,
    todayStarts,
    todayFinishes,
  };
}

export function getReplanImpact(order: ProductionQueueItem, targetSlot: number, queue: ProductionQueueItem[]) {
  const currentSlot = queue.findIndex((item) => item.id === order.id);
  if (currentSlot < 0) {
    return {
      affectedOrdersCount: 0,
      workshopImpact: "Невідомо",
      deadlineConflicts: 0,
      overloadDelta: 0,
      recommended: false,
      risky: false,
    };
  }

  const boundedTarget = Math.max(0, Math.min(queue.length - 1, targetSlot));
  const movedEarlier = boundedTarget < currentSlot;
  const affectedOrders = Math.abs(currentSlot - boundedTarget);
  const impactedQueue = queue.slice(Math.min(currentSlot, boundedTarget), Math.max(currentSlot, boundedTarget) + 1);
  const deadlineConflicts = impactedQueue.filter((item) => {
    const due = getDeadlineRiskState(item);
    return due === "overdue" || due === "will_miss_promise";
  }).length;
  const overloadDelta = movedEarlier ? Math.max(1, Math.round(affectedOrders / 2)) : -Math.round(affectedOrders / 3);
  const risky = deadlineConflicts > 0 || (movedEarlier && order.riskScore >= 70);
  const recommended = !risky && movedEarlier && order.readinessPercent >= 80;

  return {
    affectedOrdersCount: affectedOrders,
    workshopImpact: movedEarlier ? "Більше найближче навантаження на цех" : "Зменшує найближчий тиск на цех",
    deadlineConflicts,
    overloadDelta,
    recommended,
    risky,
  };
}

export function getPlanningQuickFilters(planningData: ProductionCommandCenterView) {
  const filters = [
    { id: "all", label: "Усі", predicate: (_order: ProductionQueueItem) => true },
    { id: "overdue", label: "Прострочені", predicate: (order: ProductionQueueItem) => getDeadlineRiskState(order) === "overdue" },
    {
      id: "at-risk",
      label: "Під ризиком",
      predicate: (order: ProductionQueueItem) => {
        const state = getProductionOrderOperationalState(order).key;
        return state === "at_risk" || getDeadlineRiskState(order) === "will_miss_promise";
      },
    },
    {
      id: "blocked",
      label: "Заблоковані",
      predicate: (order: ProductionQueueItem) => getProductionOrderOperationalState(order).key === "blocked",
    },
    {
      id: "ready",
      label: "Готові до старту",
      predicate: (order: ProductionQueueItem) => getProductionOrderOperationalState(order).key === "ready_to_start",
    },
  ];

  return filters.map((filter) => ({ ...filter, count: planningData.queue.filter(filter.predicate).length }));
}
