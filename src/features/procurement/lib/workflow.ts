import type { SessionUser } from "@/lib/authz/api-guard";
import { hasUnrestrictedPermissionScope } from "@/lib/authz/permissions";

export const PROCUREMENT_WORKFLOW_STATUSES = [
  "new_request",
  "in_progress_by_purchaser",
  "ai_grouping",
  "grouped_by_supplier_or_category",
  "sent_to_supplier",
  "supplier_response_received",
  "supplier_invoice_uploaded",
  "invoice_ai_matched",
  "invoice_verification",
  "approval_pending",
  "sent_to_payment",
  "payment_method_selected",
  "paid",
  "receipt_verification_pending",
  "awaiting_delivery",
  "goods_received",
  "stock_posted",
  "reserved_for_order",
  "issued_to_production",
  "rejected",
  "returned_for_revision",
] as const;

export type ProcurementWorkflowStatus =
  (typeof PROCUREMENT_WORKFLOW_STATUSES)[number];

const STATUS_SET = new Set<string>(PROCUREMENT_WORKFLOW_STATUSES);

export function isProcurementWorkflowStatus(
  status: string | null | undefined,
): status is ProcurementWorkflowStatus {
  return Boolean(status && STATUS_SET.has(status));
}

const ALLOWED_TRANSITIONS: Record<
  ProcurementWorkflowStatus,
  ProcurementWorkflowStatus[]
> = {
  new_request: ["in_progress_by_purchaser", "rejected"],
  in_progress_by_purchaser: ["ai_grouping", "returned_for_revision"],
  ai_grouping: ["grouped_by_supplier_or_category", "returned_for_revision"],
  grouped_by_supplier_or_category: ["sent_to_supplier", "returned_for_revision"],
  sent_to_supplier: ["supplier_response_received", "returned_for_revision"],
  supplier_response_received: ["supplier_invoice_uploaded", "returned_for_revision"],
  supplier_invoice_uploaded: ["invoice_ai_matched", "returned_for_revision"],
  invoice_ai_matched: ["invoice_verification", "returned_for_revision"],
  invoice_verification: ["approval_pending", "returned_for_revision"],
  approval_pending: ["sent_to_payment", "returned_for_revision", "rejected"],
  sent_to_payment: ["payment_method_selected", "returned_for_revision"],
  payment_method_selected: ["paid", "returned_for_revision"],
  paid: ["receipt_verification_pending", "returned_for_revision"],
  receipt_verification_pending: ["awaiting_delivery", "goods_received", "returned_for_revision"],
  awaiting_delivery: ["goods_received", "returned_for_revision"],
  goods_received: ["stock_posted", "returned_for_revision"],
  stock_posted: ["reserved_for_order", "returned_for_revision"],
  reserved_for_order: ["issued_to_production", "returned_for_revision"],
  issued_to_production: [],
  rejected: [],
  returned_for_revision: [
    "in_progress_by_purchaser",
    "ai_grouping",
    "grouped_by_supplier_or_category",
    "sent_to_supplier",
    "supplier_response_received",
    "supplier_invoice_uploaded",
    "invoice_ai_matched",
    "invoice_verification",
  ],
};

export function normalizeWorkflowStatus(
  status: string | null | undefined,
): ProcurementWorkflowStatus {
  if (status && STATUS_SET.has(status)) {
    return status as ProcurementWorkflowStatus;
  }
  return "new_request";
}

export function canTransitionWorkflow(
  from: ProcurementWorkflowStatus,
  to: ProcurementWorkflowStatus,
): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

function isPurchaser(user: SessionUser): boolean {
  if (
    hasUnrestrictedPermissionScope({
      realRole: user.realRole,
      impersonatorId: user.impersonatorId,
    })
  ) {
    return true;
  }
  return (
    user.realRole === "PROCUREMENT_MANAGER" || user.realRole === "ACCOUNTANT"
  );
}

function isAccountant(user: SessionUser): boolean {
  if (
    hasUnrestrictedPermissionScope({
      realRole: user.realRole,
      impersonatorId: user.impersonatorId,
    })
  ) {
    return true;
  }
  return user.realRole === "ACCOUNTANT";
}

function isApprover(user: SessionUser): boolean {
  if (
    hasUnrestrictedPermissionScope({
      realRole: user.realRole,
      impersonatorId: user.impersonatorId,
    })
  ) {
    return true;
  }
  return (
    user.realRole === "DIRECTOR" ||
    user.realRole === "SUPER_ADMIN" ||
    user.realRole === "HEAD_MANAGER" ||
    user.realRole === "ACCOUNTANT"
  );
}

export function canUserTransitionWorkflow(
  user: SessionUser,
  to: ProcurementWorkflowStatus,
): boolean {
  if (
    to === "new_request" ||
    to === "in_progress_by_purchaser" ||
    to === "ai_grouping" ||
    to === "grouped_by_supplier_or_category" ||
    to === "sent_to_supplier" ||
    to === "supplier_response_received" ||
    to === "supplier_invoice_uploaded" ||
    to === "invoice_ai_matched" ||
    to === "invoice_verification" ||
    to === "goods_received" ||
    to === "stock_posted" ||
    to === "reserved_for_order" ||
    to === "issued_to_production" ||
    to === "awaiting_delivery" ||
    to === "receipt_verification_pending"
  ) {
    return isPurchaser(user);
  }

  if (to === "rejected" || to === "returned_for_revision") {
    return isApprover(user);
  }

  if (to === "sent_to_payment") {
    return isPurchaser(user) || isApprover(user);
  }

  if (to === "paid" || to === "payment_method_selected") {
    return isAccountant(user);
  }

  if (to === "approval_pending") {
    return isPurchaser(user) || isApprover(user);
  }

  return false;
}

export type ProcurementWorkflowValidationInput = {
  hasItems: boolean;
  hasSupplier: boolean;
  hasInvoiceAttachment: boolean;
  invoiceAmount: number;
  paymentMethod: string;
  paymentFop: string;
  paymentExecutor: string;
  paymentAmount: number;
  paymentDate: Date | null;
  paymentReference: string;
  goodsReceivedAt: Date | null;
  hasWarehousePlacement: boolean;
  hasAccountingDocument: boolean;
  hasProjectItemsWithoutProject: boolean;
  hasProjectItemsOverIssued: boolean;
};

export function validateTransitionRequirements(
  to: ProcurementWorkflowStatus,
  input: ProcurementWorkflowValidationInput,
): string[] {
  const errors: string[] = [];

  if (to === "grouped_by_supplier_or_category") {
    if (!input.hasItems) errors.push("Потрібна хоча б одна позиція для групування.");
  }

  if (to === "sent_to_supplier") {
    if (!input.hasItems) errors.push("Потрібна хоча б одна позиція.");
    if (!input.hasSupplier) errors.push("Потрібно вказати постачальника.");
  }

  if (to === "supplier_invoice_uploaded") {
    if (!input.hasInvoiceAttachment) errors.push("Потрібно прикріпити рахунок.");
    if (input.invoiceAmount <= 0) errors.push("Сума рахунку має бути більше 0.");
    if (!input.hasSupplier) errors.push("Потрібно вказати постачальника.");
  }

  if (to === "invoice_ai_matched" || to === "invoice_verification") {
    if (!input.hasInvoiceAttachment) errors.push("Немає рахунку для погодження.");
    if (input.invoiceAmount <= 0) errors.push("Сума рахунку не підтверджена.");
  }

  if (to === "approval_pending") {
    if (!input.hasInvoiceAttachment) errors.push("Немає рахунку для погодження.");
    if (input.invoiceAmount <= 0) errors.push("Сума рахунку не підтверджена.");
  }

  if (to === "payment_method_selected") {
    if (!input.paymentMethod.trim()) {
      errors.push("Оберіть метод оплати (онлайн/готівка/ФОП).");
    }
    if (!input.paymentExecutor.trim() && !input.paymentFop.trim()) {
      errors.push("Вкажіть виконавця або ФОП для проведення оплати.");
    }
  }

  if (to === "paid") {
    if (!input.paymentDate) errors.push("Вкажіть дату оплати.");
    if (input.paymentAmount <= 0) errors.push("Сума оплати має бути більше 0.");
    if (!input.paymentReference.trim()) {
      errors.push("Вкажіть номер/референс платіжного документа.");
    }
  }

  if (to === "goods_received") {
    if (!input.goodsReceivedAt) errors.push("Вкажіть фактичну дату отримання товару.");
  }

  if (to === "stock_posted") {
    if (!input.hasWarehousePlacement) {
      errors.push("Потрібно вказати складське розміщення для оприбуткування.");
    }
    if (!input.hasAccountingDocument) {
      errors.push("Потрібно вказати бухгалтерський вхідний документ.");
    }
  }

  if (to === "reserved_for_order" || to === "issued_to_production") {
    if (input.hasProjectItemsWithoutProject) {
      errors.push("Є project-позиції без projectId.");
    }
    if (input.hasProjectItemsOverIssued) {
      errors.push("Є позиції з issuedQty > receivedQty.");
    }
  }

  return errors;
}
