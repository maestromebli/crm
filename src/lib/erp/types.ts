export type ErpModule = "production" | "procurement" | "finance" | "system";

export type ErpEvent = {
  id: string;
  createdAt: string;
  module: ErpModule;
  type: string;
  message: string;
  payload?: Record<string, string | number | boolean | null>;
  actor?: string;
};

export type ErpProductionOrder = {
  number: string;
  client: string;
  product: string;
  status: string;
  readinessPct: number;
  riskScore: number;
  procurementTasks: number;
  productionTasks: number;
};

export type ErpPurchaseRequest = {
  id: string;
  productionOrder: string;
  materialCode: string;
  qty: number;
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  requiredDate: string;
  comment: string;
  status: "NEW" | "IN_PROGRESS" | "DONE";
  approvedBy: string | null;
};

export type ErpFinanceDocument = {
  id: string;
  kind: "INVOICE" | "PLAN";
  direction: "INCOMING" | "OUTGOING";
  entity: string;
  amount: number;
  dueDate: string;
  productionOrder: string;
  status: "DRAFT" | "APPROVED" | "PAID";
  approvedBy: string | null;
};

export type ErpState = {
  productionOrders: ErpProductionOrder[];
  purchaseRequests: ErpPurchaseRequest[];
  financeDocuments: ErpFinanceDocument[];
  events: ErpEvent[];
};

export const ERP_BRIDGE_INITIAL_STATE: ErpState = {
  productionOrders: [],
  purchaseRequests: [],
  financeDocuments: [],
  events: [],
};
