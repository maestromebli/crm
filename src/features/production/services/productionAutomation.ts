import type { ProductionOrderOpsState } from "../types/operations-core";
import { productionSplitEngine } from "./productionSplitEngine";

export type AutomationEvent =
  | "DRAWINGS_APPROVED"
  | "MATERIALS_RECEIVED"
  | "PRODUCTION_FINISHED"
  | "INSTALLATION_PLANNED";

export type AutomationEffect = {
  type: "CREATE_SPLIT" | "UPDATE_READINESS" | "SUGGEST_NEXT_ACTION" | "CREATE_CALENDAR_EVENT";
  description: string;
};

export function runProductionAutomation(event: AutomationEvent, order: ProductionOrderOpsState): AutomationEffect[] {
  if (event === "DRAWINGS_APPROVED") {
    const split = productionSplitEngine(order);
    return [
      {
        type: "CREATE_SPLIT",
        description: `Створено: ${split.purchaseRequests.length} закупівель, ${split.productionTasks.length} задач цеху.`,
      },
    ];
  }
  if (event === "MATERIALS_RECEIVED") {
    return [{ type: "UPDATE_READINESS", description: "Оновлено readiness та складський статус." }];
  }
  if (event === "PRODUCTION_FINISHED") {
    return [{ type: "SUGGEST_NEXT_ACTION", description: "Рекомендовано запланувати монтаж." }];
  }
  return [{ type: "CREATE_CALENDAR_EVENT", description: "Автоматично створено подію календаря монтажу." }];
}
