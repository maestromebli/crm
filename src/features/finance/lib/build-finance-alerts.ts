import {
  paymentPlanOverdueStats,
  type FinanceExecutiveKpi,
} from "./aggregation";
import type { ProjectPaymentPlan } from "../types/models";
import { formatMoneyUa } from "./format-money";

export function buildFinanceOverviewAlerts(
  kpi: FinanceExecutiveKpi,
  paymentPlan: ProjectPaymentPlan[],
  referenceDay: string,
): Array<{ level: "P0" | "P1" | "P2"; text: string }> {
  const alerts: Array<{ level: "P0" | "P1" | "P2"; text: string }> = [];

  const overdue = paymentPlanOverdueStats(paymentPlan, referenceDay);
  if (overdue.overduePlanCount > 0) {
    alerts.push({
      level: "P1",
      text: `Прострочені рядки графіку оплат: ${overdue.overduePlanCount}, залишок до сплати ${formatMoneyUa(overdue.overduePlanAmount)} UAH.`,
    });
  }

  if (kpi.receivables > 0) {
    alerts.push({
      level: "P2",
      text: `Дебіторська заборгованість клієнтів (портфель): ${formatMoneyUa(kpi.receivables)} UAH.`,
    });
  }

  if (kpi.netProfitCash < 0) {
    alerts.push({
      level: "P0",
      text: `Відʼємний чистий грошовий результат (спрощена модель): ${formatMoneyUa(kpi.netProfitCash)} UAH.`,
    });
  }

  if (kpi.payables > 0 && alerts.length < 4) {
    alerts.push({
      level: "P2",
      text: `Кредиторка (зобовʼязання): ${formatMoneyUa(kpi.payables)} UAH.`,
    });
  }

  if (alerts.length === 0) {
    alerts.push({
      level: "P2",
      text: "За поточними агрегатами критичних сигналів не виявлено.",
    });
  }

  return alerts.slice(0, 5);
}
