import type {
  FinanceKpi,
  FinanceTransaction,
  PayrollEntry,
  ProjectCommission,
  ProjectFinancialSummary,
  ProjectPaymentPlan,
} from "../types/models";
import type { ProcurementItem } from "../../procurement/types/models";
import type { Project } from "../../shared/types/entities";

const sum = (arr: number[]): number => arr.reduce((a, b) => a + b, 0);

export function calculateFinanceKpi(
  projects: Project[],
  transactions: FinanceTransaction[],
  payroll: PayrollEntry[],
  commissions: ProjectCommission[],
  procurementItems: ProcurementItem[],
): FinanceKpi {
  const revenue = sum(projects.map((p) => p.contractAmount));
  const received = sum(
    transactions.filter((t) => t.type === "INCOME").map((t) => t.amount),
  );
  const payrollTotal = sum(payroll.map((p) => p.amount));
  const commissionTotal = sum(commissions.map((c) => c.calculatedAmount));
  const expenseTx = sum(
    transactions
      .filter((t) => t.type === "EXPENSE")
      .map((t) => t.amount),
  );
  // Strategy: actual procurement costs included only when actualTotalCost exists
  // and not duplicated by EXPENSE finance rows. For mock foundation we include procurement directly.
  const procurementActual = sum(
    procurementItems.map((i) => i.actualTotalCost ?? i.plannedTotalCost),
  );
  const expenses = expenseTx + payrollTotal + commissionTotal + procurementActual;
  const clientDebt = Math.max(revenue - received, 0);
  const grossProfit = revenue - (expenseTx + procurementActual);
  const netProfit = grossProfit - payrollTotal - commissionTotal;
  return { revenue, received, clientDebt, expenses, grossProfit, netProfit };
}

export function calculateProjectSummary(
  project: Project,
  paymentPlan: ProjectPaymentPlan[],
  transactions: FinanceTransaction[],
  payroll: PayrollEntry[],
  commissions: ProjectCommission[],
  procurementItems: ProcurementItem[],
): ProjectFinancialSummary {
  const tx = transactions.filter((t) => t.projectId === project.id);
  const pp = paymentPlan.filter((p) => p.projectId === project.id);
  const py = payroll.filter((p) => p.projectId === project.id);
  const cm = commissions.filter((c) => c.projectId === project.id);
  const pr = procurementItems.filter((i) => i.projectId === project.id);

  const receivedFromClient = sum(
    tx.filter((t) => t.type === "INCOME").map((t) => t.amount),
  );
  const payrollTotal = sum(py.map((p) => p.amount));
  const commissionTotal = sum(cm.map((c) => c.calculatedAmount));
  const actualExpensesWithoutPayrollAndCommission = sum(
    tx.filter((t) => t.type === "EXPENSE").map((t) => t.amount),
  ) + sum(pr.map((i) => i.actualTotalCost ?? i.plannedTotalCost));
  const actualExpenses =
    actualExpensesWithoutPayrollAndCommission + payrollTotal + commissionTotal;
  const grossProfit = project.contractAmount - actualExpensesWithoutPayrollAndCommission;
  const netProfit = grossProfit - payrollTotal - commissionTotal;
  const plannedExpenses =
    sum(pr.map((i) => i.plannedTotalCost)) +
    sum(py.filter((p) => p.status !== "CANCELLED").map((p) => p.amount)) +
    sum(cm.filter((c) => c.status !== "CANCELLED").map((c) => c.calculatedAmount));
  const outstandingFromClient = Math.max(project.contractAmount - receivedFromClient, 0);
  const supplierDebt = sum(
    pr
      .filter((i) => (i.actualTotalCost ?? 0) > 0 && i.status !== "RECEIVED")
      .map((i) => i.actualTotalCost ?? 0),
  );
  const paidByPlan = sum(pp.map((p) => p.paidAmount));
  const clientDebt = Math.max(project.contractAmount - Math.max(receivedFromClient, paidByPlan), 0);

  return {
    projectId: project.id,
    contractAmount: project.contractAmount,
    plannedExpenses,
    actualExpenses,
    receivedFromClient,
    outstandingFromClient,
    grossProfit,
    netProfit,
    payrollTotal,
    commissionTotal,
    supplierDebt,
    clientDebt,
    lastCalculatedAt: new Date().toISOString(),
  };
}

