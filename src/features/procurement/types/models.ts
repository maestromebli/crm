export type Uuid = string;

export type ProcurementRequestStatus =
  | "DRAFT"
  | "PENDING_APPROVAL"
  | "APPROVED"
  | "ORDERED"
  | "PARTIALLY_RECEIVED"
  | "RECEIVED"
  | "CLOSED"
  | "CANCELLED";

export type ProcurementWorkflowStatus =
  | "new_request"
  | "in_progress_by_purchaser"
  | "ai_grouping"
  | "grouped_by_supplier_or_category"
  | "sent_to_supplier"
  | "supplier_response_received"
  | "supplier_invoice_uploaded"
  | "invoice_ai_matched"
  | "invoice_verification"
  | "approval_pending"
  | "sent_to_payment"
  | "payment_method_selected"
  | "paid"
  | "receipt_verification_pending"
  | "awaiting_delivery"
  | "goods_received"
  | "stock_posted"
  | "reserved_for_order"
  | "issued_to_production"
  | "rejected"
  | "returned_for_revision";

export type PurchaseOrderStatus =
  | "DRAFT"
  | "SENT"
  | "CONFIRMED"
  | "PAID"
  | "PARTIALLY_DELIVERED"
  | "DELIVERED"
  | "CANCELLED";

export type ProcurementGroup =
  | "MATERIAL"
  | "LABOR"
  | "OUTSOURCE"
  | "LOGISTICS"
  | "SERVICE";

export type Supplier = {
  id: Uuid;
  name: string;
  type: "MATERIAL" | "SERVICE" | "LOGISTICS" | "OUTSOURCE";
  contactPerson: string;
  phone: string;
  email: string;
  paymentTerms: string;
  notes: string;
  isActive: boolean;
};

export type ProcurementCategory = {
  id: Uuid;
  name: string;
  group: ProcurementGroup;
  sortOrder: number;
};

export type ProcurementRequest = {
  id: Uuid;
  projectId: Uuid;
  objectId: Uuid | null;
  requestedById: Uuid | null;
  status: ProcurementRequestStatus;
  workflowStatus?: ProcurementWorkflowStatus;
  neededByDate: string | null;
  budgetTotal: number;
  actualTotal: number;
  comment: string;
};

export type ProcurementItemStatus =
  | "DRAFT"
  | "APPROVED"
  | "ORDERED"
  | "PARTIALLY_RECEIVED"
  | "RECEIVED"
  | "CANCELLED";

export type ProcurementItem = {
  id: Uuid;
  requestId: Uuid;
  projectId: Uuid;
  objectId: Uuid | null;
  categoryId: Uuid;
  itemType: ProcurementGroup;
  name: string;
  article: string | null;
  unit: string;
  qty: number;
  plannedUnitCost: number;
  plannedTotalCost: number;
  actualUnitCost: number | null;
  actualTotalCost: number | null;
  supplierId: Uuid | null;
  status: ProcurementItemStatus;
  isCustom: boolean;
  comment: string;
};

export type PurchaseOrder = {
  id: Uuid;
  supplierId: Uuid;
  projectId: Uuid;
  requestId: Uuid | null;
  orderNumber: string;
  status: PurchaseOrderStatus;
  orderDate: string;
  expectedDate: string | null;
  totalAmount: number;
  comment: string;
};

export type PurchaseOrderItem = {
  id: Uuid;
  purchaseOrderId: Uuid;
  procurementItemId: Uuid | null;
  name: string;
  article: string | null;
  unit: string;
  qty: number;
  price: number;
  total: number;
  receivedQty: number;
};

export type GoodsReceipt = {
  id: Uuid;
  purchaseOrderId: Uuid;
  projectId: Uuid;
  receiptDate: string;
  receivedById: Uuid | null;
  comment: string;
};

export type GoodsReceiptItem = {
  id: Uuid;
  receiptId: Uuid;
  purchaseOrderItemId: Uuid;
  receivedQty: number;
  acceptedQty: number;
  damagedQty: number;
  comment: string;
};

