import type {
  ProcurementCategory,
  ProcurementItem,
  ProcurementRequest,
  PurchaseOrder,
  PurchaseOrderItem,
  GoodsReceipt,
  GoodsReceiptItem,
  Supplier,
} from "./models";
import type { OrderedLineMonitorRow } from "../lib/ordered-line-monitor";

export type ProcurementOverviewBundle = {
  kpi: {
    planned: number;
    actual: number;
    ordered: number;
    committed: number;
    receivedValue: number;
    paidSupplier: number;
    awaitingDelivery: number;
    overrun: number;
    openCommitmentGap: number;
  };
  requests: ProcurementRequest[];
  items: ProcurementItem[];
  purchaseOrders: PurchaseOrder[];
  purchaseOrderItems: PurchaseOrderItem[];
  suppliers: Supplier[];
  receipts: GoodsReceipt[];
  receiptItems: GoodsReceiptItem[];
  categories: ProcurementCategory[];
  saasControl: {
    openRequestCount: number;
    overdueOpenRequestCount: number;
    onTimeDeliveryRatePct: number;
    commitmentCoveragePct: number;
    topSupplierConcentrationPct: number;
    receiptQualityRate: number;
    supplierScorecard: Array<{
      supplierId: string;
      supplierName: string;
      spend: number;
      sharePct: number;
      openPoCount: number;
    }>;
    overdueRequests: Array<{
      requestId: string;
      projectId: string;
      neededByDate: string | null;
      status: string;
      budgetTotal: number;
    }>;
    supplierRisks: Array<{
      supplierId: string;
      supplierName: string;
      slaPct: number;
      paymentDisciplinePct: number;
      lateOrders: number;
      riskScore: number;
      riskLabel: string;
    }>;
    systemicRiskScore: number;
  };
  projectNameById: Record<string, string>;
  supplierNameById: Record<string, string>;
  orderNumberById: Record<string, string>;
  dataSource: "live";
  riskAlerts: Array<{ level: "P0" | "P1" | "P2"; text: string }>;
  /** Відкриті позиції за строками заявки та фінансовими індикаторами. */
  orderedLineMonitor: OrderedLineMonitorRow[];
};
