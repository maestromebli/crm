import type { FinanceTransaction } from "../types/models";
import type { PayrollEntry } from "../types/models";
import type { ProcurementItem } from "../../procurement/types/models";
import type { PurchaseOrder } from "../../procurement/types/models";
import type { Project, ProjectObject } from "../../shared/types/entities";

export type ObjectFinanceLedgerRow = {
  objectId: string;
  projectId: string;
  projectCode: string;
  projectTitle: string;
  objectTitle: string;
  objectAddress: string;
  /** Загальна вартість замовлення (сума договору). */
  orderTotalAmount: number;
  incomeCash: number;
  expenseCash: number;
  payrollCash: number;
  commissionCash: number;
  procurementPlanned: number;
  procurementAccrual: number;
  payrollAccrued: number;
  /** Відкриті PO по проєкту (у демо 1 обʼєкт = 1 адреса на проєкт — сума на рівні замовлення). */
  openPurchaseOrders: number;
};

function sumTx(
  txs: FinanceTransaction[],
  pred: (t: FinanceTransaction) => boolean,
): number {
  return txs.filter(pred).reduce((a, t) => a + t.amount, 0);
}

/** Реєстр показників по кожному обʼєкту (адреса) + звʼязок з замовленням (проєкт) і закупівлею. */
export function buildObjectFinanceLedger(
  projects: Project[],
  objects: ProjectObject[],
  transactions: FinanceTransaction[],
  procurementItems: ProcurementItem[],
  purchaseOrders: PurchaseOrder[],
  payroll: PayrollEntry[],
): ObjectFinanceLedgerRow[] {
  const projectById = new Map(projects.map((p) => [p.id, p]));
  const recorded = transactions.filter((t) => t.status !== "CANCELLED");

  const openPoByProject = new Map<string, number>();
  for (const po of purchaseOrders) {
    if (po.status === "PAID" || po.status === "CANCELLED") continue;
    openPoByProject.set(po.projectId, (openPoByProject.get(po.projectId) ?? 0) + po.totalAmount);
  }

  return objects.map((obj) => {
    const project = projectById.get(obj.projectId);
    const code = project?.code ?? "—";
    const title = project?.title ?? "—";

    const txs = recorded.filter(
      (t) => t.objectId === obj.id || (t.objectId === null && t.projectId === obj.projectId),
    );
    const items = procurementItems.filter((i) => i.objectId === obj.id);

    const payrollForObject = payroll.filter(
      (p) =>
        p.projectId === obj.projectId &&
        (p.objectId === obj.id || p.objectId === null || p.objectId === undefined),
    );

    return {
      objectId: obj.id,
      projectId: obj.projectId,
      projectCode: code,
      projectTitle: title,
      objectTitle: obj.title,
      objectAddress: obj.address,
      orderTotalAmount: project?.contractAmount ?? 0,
      incomeCash: sumTx(txs, (t) => t.type === "INCOME"),
      expenseCash: sumTx(txs, (t) => t.type === "EXPENSE"),
      payrollCash: sumTx(txs, (t) => t.type === "PAYROLL"),
      commissionCash: sumTx(txs, (t) => t.type === "COMMISSION"),
      procurementPlanned: items.reduce((a, i) => a + i.plannedTotalCost, 0),
      procurementAccrual: items.reduce((a, i) => a + (i.actualTotalCost ?? i.plannedTotalCost), 0),
      payrollAccrued: payrollForObject
        .filter((p) => p.status !== "CANCELLED")
        .reduce((a, p) => a + p.amount, 0),
      openPurchaseOrders: openPoByProject.get(obj.projectId) ?? 0,
    };
  });
}

export function consolidateObjectLedger(rows: ObjectFinanceLedgerRow[]): ObjectFinanceLedgerRow {
  const uniqueOrderTotals = new Map<string, number>();
  for (const row of rows) {
    if (!uniqueOrderTotals.has(row.projectId)) {
      uniqueOrderTotals.set(row.projectId, row.orderTotalAmount);
    }
  }
  const portfolioOrderTotal = [...uniqueOrderTotals.values()].reduce((sum, value) => sum + value, 0);

  const z = rows.reduce(
    (acc, r) => ({
      incomeCash: acc.incomeCash + r.incomeCash,
      expenseCash: acc.expenseCash + r.expenseCash,
      payrollCash: acc.payrollCash + r.payrollCash,
      commissionCash: acc.commissionCash + r.commissionCash,
      procurementPlanned: acc.procurementPlanned + r.procurementPlanned,
      procurementAccrual: acc.procurementAccrual + r.procurementAccrual,
      payrollAccrued: acc.payrollAccrued + r.payrollAccrued,
      openPurchaseOrders: acc.openPurchaseOrders + r.openPurchaseOrders,
    }),
    {
      incomeCash: 0,
      expenseCash: 0,
      payrollCash: 0,
      commissionCash: 0,
      procurementPlanned: 0,
      procurementAccrual: 0,
      payrollAccrued: 0,
      openPurchaseOrders: 0,
    },
  );
  return {
    objectId: "__all__",
    projectId: "__portfolio__",
    projectCode: "Σ",
    projectTitle: "Усі замовлення та обʼєкти",
    objectTitle: "Консолідовано",
    objectAddress: "—",
    orderTotalAmount: portfolioOrderTotal,
    ...z,
  };
}
