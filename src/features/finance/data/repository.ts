import type { FinanceKpi } from "../types/models";
import {
  buildExecutiveKpi,
  type FinanceExecutiveKpi,
} from "../lib/aggregation";
import { buildObjectFinanceLedger, consolidateObjectLedger } from "../lib/object-finance";
import { loadFinanceProjectDetail, loadLiveFinanceOverview } from "@/lib/finance/live-finance-overview";
import { FINANCE_ACCOUNT_CATALOG, FINANCE_CATEGORY_CATALOG } from "@/lib/finance/finance-dictionaries";

function executiveToLegacyKpi(e: FinanceExecutiveKpi): FinanceKpi {
  return {
    revenue: e.contractPortfolio,
    received: e.receivedFromClients,
    clientDebt: e.receivables,
    expenses: e.cashOperatingExpenses,
    grossProfit: e.grossProfitCash,
    netProfit: e.netProfitCash,
  };
}

export async function getFinanceOverviewData() {
  if (process.env.DATABASE_URL?.trim()) {
    try {
      return await loadLiveFinanceOverview();
    } catch (e) {
      console.error("[getFinanceOverviewData] live failed", e);
    }
  }
  return getEmptyFinanceOverviewData();
}

function getEmptyFinanceOverviewData() {
  const categories = FINANCE_CATEGORY_CATALOG;
  const accounts = FINANCE_ACCOUNT_CATALOG;
  const executive = buildExecutiveKpi([], [], [], [], [], [], [], categories);
  const kpi = executiveToLegacyKpi(executive);
  const objectLedger = buildObjectFinanceLedger([], [], [], [], [], []);
  const objectLedgerConsolidated = consolidateObjectLedger(objectLedger);

  return {
    kpi,
    executive,
    objectLedger,
    objectLedgerConsolidated,
    transactions: [],
    categories,
    accounts,
    paymentPlan: [],
    saasAccounting: {
      latestIncomeAt: null,
      overduePlanAmount: 0,
      overduePlanCount: 0,
      cashRunwayDays: 0,
      procurementCoveragePct: 100,
      topSupplierConcentrationPct: 0,
      openPayables: 0,
      receivablesByBucket: { current: 0, d1_30: 0, d31_60: 0, d60p: 0 },
      payablesByBucket: { current: 0, d1_30: 0, d31_60: 0, d60p: 0 },
      projectHealth: [],
      projectNameById: {},
      arLedger: [],
      apLedger: [],
      cashflowForecast8w: [],
      riskIndex: 0,
      riskLabel: "Контрольований",
    },
    financeAlerts: [{ level: "P2" as const, text: "Фінансові дані у CRM поки відсутні." }],
  };
}

export async function getFinanceProjectData(projectId: string) {
  if (!process.env.DATABASE_URL?.trim()) return null;
  try {
    return await loadFinanceProjectDetail(projectId);
  } catch (e) {
    console.error("[getFinanceProjectData] live failed", e);
    return null;
  }
}
