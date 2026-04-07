/**
 * Сумісність: re-export агрегації. Логіка — у `../lib/aggregation.ts`.
 */
export {
  buildExecutiveKpi,
  calculateProjectSummary,
  sumClientIncome,
  sumCashOperatingOutflow,
  sumProcurementPlanned,
  sumProcurementAccrual,
  sumSupplierPayables,
  buildOperatingCashBreakdown,
  emptyOperatingBreakdown,
  sumOperatingBreakdown,
  sumPurchaseOrderCommitment,
  sumReceivedValueFromPoItems,
  paymentPlanOverdueStats,
  isPaymentPlanOverdue,
} from "../lib/aggregation";
export type { FinanceExecutiveKpi } from "../lib/aggregation";

import type { FinanceKpi } from "../types/models";
import type { FinanceExecutiveKpi } from "../lib/aggregation";

/** Мапінг на старий тип для поступової міграції компонентів. */
export function executiveToLegacyKpi(e: FinanceExecutiveKpi): FinanceKpi {
  return {
    revenue: e.contractPortfolio,
    received: e.receivedFromClients,
    clientDebt: e.receivables,
    expenses: e.cashOperatingExpenses,
    grossProfit: e.grossProfitCash,
    netProfit: e.netProfitCash,
  };
}
