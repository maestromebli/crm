import type { ProductionCommandCenterView, ProductionQueueItem } from "../../types/production";
import {
  getDeadlineRiskState,
  getPlanningPriorityReason,
  getProductionOrderOperationalState,
  type DeadlineRiskState,
  type OperationalState,
} from "./planning-selectors";

export type ProductionOrderViewModel = {
  order: ProductionQueueItem;
  position: number;
  plannedStart: string;
  plannedFinish: string;
  workshopAssignment: string;
  dependency: string;
  operationalState: { key: OperationalState; label: string };
  deadlineRisk: DeadlineRiskState;
  priorityReason: { code: string; label: string };
};

function plusDaysLabel(daysFromNow: number): string {
  if (daysFromNow <= 0) return "сьогодні";
  return `+${daysFromNow}д`;
}

export function buildOrderViewModels(data: ProductionCommandCenterView): ProductionOrderViewModel[] {
  const stations = data.stationLoads.length > 0 ? [...data.stationLoads].sort((a, b) => a.loadPercent - b.loadPercent) : [];
  return data.queue.map((order, index) => {
    const station = stations.length > 0 ? stations[index % stations.length] : null;
    const plannedStartDays = Math.floor(index / Math.max(1, stations.length || 1));
    const plannedFinishDays = plannedStartDays + 1;
    const dependency =
      order.blockersCount > 0
        ? `${order.blockersCount} блокер(ів)`
        : order.openQuestionsCount > 0
          ? `${order.openQuestionsCount} відкритих питань`
          : "Без блокерів";

    return {
      order,
      position: index + 1,
      plannedStart: plusDaysLabel(plannedStartDays),
      plannedFinish: plusDaysLabel(plannedFinishDays),
      workshopAssignment: station ? station.stationLabel : "Цех не призначено",
      dependency,
      operationalState: getProductionOrderOperationalState(order),
      deadlineRisk: getDeadlineRiskState(order),
      priorityReason: getPlanningPriorityReason(order),
    };
  });
}
