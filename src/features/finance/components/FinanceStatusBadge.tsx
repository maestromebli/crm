import { StatusBadge } from "@/components/shared/StatusBadge";
import { financeTransactionStatusUa, paymentPlanStatusUa } from "../lib/labels";

type Tone = "neutral" | "success" | "warning" | "danger" | "info";

function pickTransactionTone(status: string): Tone {
  if (status === "CONFIRMED") return "success";
  if (status === "DRAFT") return "neutral";
  if (status === "CANCELLED") return "danger";
  return "neutral";
}

function pickPaymentPlanTone(status: string): Tone {
  if (status === "PAID") return "success";
  if (status === "PARTIALLY_PAID") return "info";
  if (status === "OVERDUE") return "warning";
  if (status === "CANCELLED") return "danger";
  if (status === "PLANNED") return "neutral";
  return "neutral";
}

/** Статус фінансової транзакції (DRAFT / CONFIRMED / CANCELLED). */
export function FinanceTransactionStatusBadge({ status }: { status: string }) {
  return (
    <StatusBadge label={financeTransactionStatusUa(status)} tone={pickTransactionTone(status)} />
  );
}

/** Статус рядка графіку оплат. */
export function PaymentPlanStatusBadge({ status }: { status: string }) {
  return <StatusBadge label={paymentPlanStatusUa(status)} tone={pickPaymentPlanTone(status)} />;
}

/**
 * @deprecated Використовуйте FinanceTransactionStatusBadge або PaymentPlanStatusBadge.
 * Залишено для сумісності зі старими імпортами.
 */
export function FinanceStatusBadge({ status }: { status: string }) {
  if (status === "PLANNED" || status === "PARTIALLY_PAID" || status === "OVERDUE") {
    return <PaymentPlanStatusBadge status={status} />;
  }
  return <FinanceTransactionStatusBadge status={status} />;
}
