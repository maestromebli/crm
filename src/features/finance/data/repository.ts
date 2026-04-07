import {
  mockClients,
  mockCommissions,
  mockFinanceAccounts,
  mockFinanceCategories,
  mockPaymentPlan,
  mockPayroll,
  mockProcurementItems,
  mockProjectObjects,
  mockProjects,
  mockPurchaseOrderItems,
  mockPurchaseOrders,
  mockSuppliers,
  mockTransactions,
} from "../../shared/data/mock-crm";
import type { FinanceKpi } from "../types/models";
import {
  buildExecutiveKpi,
  calculateProjectSummary,
  type FinanceExecutiveKpi,
  paymentPlanOverdueStats,
} from "../lib/aggregation";
import { buildObjectFinanceLedger, consolidateObjectLedger } from "../lib/object-finance";
import { loadFinanceProjectDetail, loadLiveFinanceOverview } from "@/lib/finance/live-finance-overview";

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
      console.error("[getFinanceOverviewData] live failed, using mock demo data", e);
    }
  }
  return getMockFinanceOverviewData();
}

function getMockFinanceOverviewData() {
  const executive = buildExecutiveKpi(
    mockProjects,
    mockTransactions,
    mockPayroll,
    mockCommissions,
    mockProcurementItems,
    mockPurchaseOrders,
    mockPurchaseOrderItems,
    mockFinanceCategories,
  );
  const kpi = executiveToLegacyKpi(executive);
  const referenceDay = "2026-03-31";
  const overduePlan = paymentPlanOverdueStats(mockPaymentPlan, referenceDay);
  const paidTransactions = mockTransactions.filter((t) => t.status === "CONFIRMED");
  const latestIncomeAt = paidTransactions
    .filter((t) => t.type === "INCOME")
    .sort((a, b) => b.transactionDate.localeCompare(a.transactionDate))[0]?.transactionDate ?? null;
  const monthlyExpense = Math.max(
    1,
    paidTransactions
      .filter((t) => t.type === "EXPENSE" || t.type === "PAYROLL" || t.type === "COMMISSION")
      .reduce((acc, t) => acc + t.amount, 0) / 3,
  );
  const openPayables = executive.payables;
  const coveragePct =
    executive.procurementCommitted > 0
      ? (executive.procurementReceivedValue / executive.procurementCommitted) * 100
      : 100;
  const topSupplierSpend = mockPurchaseOrders
    .filter((o) => o.status !== "CANCELLED")
    .reduce<Record<string, number>>((acc, po) => {
      acc[po.supplierId] = (acc[po.supplierId] ?? 0) + po.totalAmount;
      return acc;
    }, {});
  const totalSupplierSpend = Object.values(topSupplierSpend).reduce((a, b) => a + b, 0);
  const topSupplierShare =
    totalSupplierSpend > 0
      ? (Math.max(...Object.values(topSupplierSpend)) / totalSupplierSpend) * 100
      : 0;

  const projectMap = new Map(mockProjects.map((p) => [p.id, p]));
  const receivablesByBucket = {
    current: 0,
    d1_30: 0,
    d31_60: 0,
    d60p: 0,
  };
  for (const p of mockProjects) {
    const remaining = Math.max(
      p.contractAmount -
        mockTransactions
          .filter((t) => t.projectId === p.id && t.type === "INCOME" && t.status === "CONFIRMED")
          .reduce((acc, t) => acc + t.amount, 0),
      0,
    );
    const due = p.dueDate;
    if (!due || remaining <= 0) continue;
    if (due >= referenceDay) receivablesByBucket.current += remaining;
    else if (due >= "2026-03-01") receivablesByBucket.d1_30 += remaining;
    else if (due >= "2026-02-01") receivablesByBucket.d31_60 += remaining;
    else receivablesByBucket.d60p += remaining;
  }

  const payablesByBucket = {
    current: 0,
    d1_30: 0,
    d31_60: 0,
    d60p: 0,
  };
  for (const po of mockPurchaseOrders) {
    if (po.status === "CANCELLED" || po.status === "PAID") continue;
    const amount = po.totalAmount;
    const eta = po.expectedDate;
    if (!eta) {
      payablesByBucket.current += amount;
      continue;
    }
    if (eta >= referenceDay) payablesByBucket.current += amount;
    else if (eta >= "2026-03-01") payablesByBucket.d1_30 += amount;
    else if (eta >= "2026-02-01") payablesByBucket.d31_60 += amount;
    else payablesByBucket.d60p += amount;
  }

  const arLedger = mockProjects
    .map((project) => {
      const invoiced = project.contractAmount;
      const received = paidTransactions
        .filter((t) => t.projectId === project.id && t.type === "INCOME")
        .reduce((acc, t) => acc + t.amount, 0);
      const outstanding = Math.max(invoiced - received, 0);
      return {
        projectId: project.id,
        projectCode: project.code,
        projectTitle: project.title,
        clientName: mockClients.find((c) => c.id === project.clientId)?.name ?? "—",
        invoiced,
        received,
        outstanding,
        dueDate: project.dueDate,
      };
    })
    .filter((row) => row.invoiced > 0)
    .sort((a, b) => b.outstanding - a.outstanding);

  const apLedger = mockPurchaseOrders
    .filter((po) => po.status !== "CANCELLED")
    .map((po) => ({
      purchaseOrderId: po.id,
      orderNumber: po.orderNumber,
      supplierName: mockSuppliers.find((s) => s.id === po.supplierId)?.name ?? "—",
      total: po.totalAmount,
      paid: po.status === "PAID" ? po.totalAmount : 0,
      outstanding: po.status === "PAID" ? 0 : po.totalAmount,
      expectedDate: po.expectedDate,
      status: po.status,
    }))
    .sort((a, b) => b.outstanding - a.outstanding);

  const recentCashflow = paidTransactions
    .slice()
    .sort((a, b) => a.transactionDate.localeCompare(b.transactionDate))
    .slice(-30);
  const avgIncomeDaily =
    recentCashflow.filter((t) => t.type === "INCOME").reduce((acc, t) => acc + t.amount, 0) / 30;
  const avgExpenseDaily =
    recentCashflow
      .filter((t) => t.type === "EXPENSE" || t.type === "PAYROLL" || t.type === "COMMISSION")
      .reduce((acc, t) => acc + t.amount, 0) / 30;
  const baselineBalance = executive.receivedFromClients - executive.cashOperatingExpenses;
  const cashflowForecast8w = Array.from({ length: 8 }).map((_, index) => {
    const weekNo = index + 1;
    const inflow = Math.round(avgIncomeDaily * 7 * (1 + (index % 3 === 0 ? 0.05 : 0)));
    const outflow = Math.round(avgExpenseDaily * 7 * (1 + (index % 4 === 1 ? 0.04 : 0)));
    const net = inflow - outflow;
    return {
      week: `W${weekNo}`,
      inflow,
      outflow,
      net,
      projectedBalance: Math.round(baselineBalance + net * weekNo),
    };
  });

  const riskIndex = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        (overduePlan.overduePlanAmount > 0 ? 35 : 0) +
          (topSupplierShare > 45 ? 20 : 8) +
          (coveragePct < 65 ? 20 : 8) +
          (executive.receivables > executive.contractPortfolio * 0.35 ? 15 : 5) +
          (baselineBalance < 0 ? 10 : 3),
      ),
    ),
  );
  const riskLabel = riskIndex >= 70 ? "Критичний" : riskIndex >= 45 ? "Підвищений" : "Контрольований";

  const objectLedger = buildObjectFinanceLedger(
    mockProjects,
    mockProjectObjects,
    mockTransactions,
    mockProcurementItems,
    mockPurchaseOrders,
    mockPayroll,
  );
  const objectLedgerConsolidated = consolidateObjectLedger(objectLedger);

  return {
    kpi,
    executive,
    objectLedger,
    objectLedgerConsolidated,
    transactions: mockTransactions,
    categories: mockFinanceCategories,
    accounts: mockFinanceAccounts,
    paymentPlan: mockPaymentPlan,
    saasAccounting: {
      latestIncomeAt,
      overduePlanAmount: overduePlan.overduePlanAmount,
      overduePlanCount: overduePlan.overduePlanCount,
      cashRunwayDays: Math.round(
        ((executive.receivedFromClients - executive.cashOperatingExpenses) / monthlyExpense) * 30,
      ),
      procurementCoveragePct: Number(coveragePct.toFixed(1)),
      topSupplierConcentrationPct: Number(topSupplierShare.toFixed(1)),
      openPayables,
      receivablesByBucket,
      payablesByBucket,
      projectHealth: mockProjects.map((project) => {
        const summary = calculateProjectSummary(
          project,
          mockPaymentPlan,
          mockTransactions,
          mockPayroll,
          mockCommissions,
          mockProcurementItems,
          mockPurchaseOrders,
          mockPurchaseOrderItems,
          mockFinanceCategories,
          referenceDay,
        );
        const client = mockClients.find((c) => c.id === project.clientId);
        return {
          projectId: project.id,
          projectCode: project.code,
          projectTitle: project.title,
          clientName: client?.name ?? "—",
          marginPct:
            project.contractAmount > 0
              ? Number(((summary.netProfit / project.contractAmount) * 100).toFixed(1))
              : 0,
          overduePlanAmount: summary.overduePlanAmount,
          payables: summary.supplierDebt,
          status:
            summary.overduePlanAmount > 0 ? "risk" : summary.netProfit < 0 ? "warning" : "ok",
        };
      }),
      projectNameById: Object.fromEntries(
        Array.from(projectMap.values()).map((p) => [p.id, `${p.code} · ${p.title}`]),
      ),
      arLedger,
      apLedger,
      cashflowForecast8w,
      riskIndex,
      riskLabel,
    },
    financeAlerts: [
      { level: "P1" as const, text: "Є прострочені платежі по 2 проєктах." },
      { level: "P0" as const, text: "Перевищено бюджет закупок у проєкті EN-2026-003." },
      { level: "P2" as const, text: "Потрібно закрити 3 акти підрядників." },
    ],
  };
}

export async function getFinanceProjectData(projectId: string) {
  if (process.env.DATABASE_URL?.trim()) {
    try {
      const live = await loadFinanceProjectDetail(projectId);
      if (live) return live;
    } catch (e) {
      console.error("[getFinanceProjectData] live failed, mock fallback", e);
    }
  }

  const project = mockProjects.find((p) => p.id === projectId) ?? null;
  if (!project) return null;
  const summary = calculateProjectSummary(
    project,
    mockPaymentPlan,
    mockTransactions,
    mockPayroll,
    mockCommissions,
    mockProcurementItems,
    mockPurchaseOrders,
    mockPurchaseOrderItems,
    mockFinanceCategories,
    "2026-03-31",
  );
  return {
    project,
    summary,
    objects: mockProjectObjects.filter((o) => o.projectId === projectId),
    paymentPlan: mockPaymentPlan.filter((p) => p.projectId === projectId),
    incomes: mockTransactions.filter((t) => t.projectId === projectId && t.type === "INCOME"),
    expenses: mockTransactions.filter((t) => t.projectId === projectId && t.type === "EXPENSE"),
    payroll: mockPayroll.filter((p) => p.projectId === projectId),
    commissions: mockCommissions.filter((c) => c.projectId === projectId),
    transactions: mockTransactions.filter((t) => t.projectId === projectId),
    clientName: mockClients.find((c) => c.id === project.clientId)?.name ?? "—",
  };
}
