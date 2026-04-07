import type { DealWorkspaceMeta, DealWorkspacePayload } from "./workspace-types";
import type { PaymentMoneySummary, PaymentStripSummary } from "./summary-types";

export type EffectivePaymentMilestone = {
  id: string;
  label: string;
  amount?: number;
  currency?: string;
  done: boolean;
};

export type PaymentMilestoneRowPayload =
  DealWorkspacePayload["paymentMilestones"][number];

/** Віхи з DealPaymentMilestone, інакше з workspaceMeta.payment. */
export function getEffectivePaymentMilestonesFromParts(
  meta: DealWorkspaceMeta,
  paymentMilestones: PaymentMilestoneRowPayload[] | null | undefined,
): EffectivePaymentMilestone[] {
  const rows = Array.isArray(paymentMilestones) ? paymentMilestones : [];
  if (rows.length > 0) {
    return rows.map((m) => ({
      id: m.id,
      label: m.label?.trim() ? m.label.trim() : "Віха",
      amount: m.amount ?? undefined,
      currency: m.currency ?? undefined,
      done: m.confirmedAt != null,
    }));
  }
  const ms = meta.payment?.milestones ?? [];
  return ms.map((m) => ({
    id: m.id,
    label: m.label,
    amount: m.amount,
    currency: m.currency,
    done: m.done,
  }));
}

/** Віхи з DealPaymentMilestone, інакше з workspaceMeta.payment. */
export function getEffectivePaymentMilestones(
  data: DealWorkspacePayload,
): EffectivePaymentMilestone[] {
  return getEffectivePaymentMilestonesFromParts(
    data.meta,
    data.paymentMilestones ?? [],
  );
}

export function derivePaymentMoneySummaryForPayload(
  data: DealWorkspacePayload,
): PaymentMoneySummary {
  const ms = getEffectivePaymentMilestones(data);
  if (ms.length === 0) {
    return {
      hasNumeric: false,
      total: 0,
      paid: 0,
      remaining: 0,
      currency: data.deal.currency,
    };
  }
  let total = 0;
  let paid = 0;
  let c = data.deal.currency ?? ms[0]?.currency ?? null;
  let hasNumericAmount = false;
  for (const m of ms) {
    if (m.amount != null && m.amount > 0) hasNumericAmount = true;
    const a = m.amount ?? 0;
    total += a;
    if (m.done) paid += a;
    if (m.currency?.trim()) c = m.currency.trim();
  }
  return {
    hasNumeric: hasNumericAmount,
    total,
    paid,
    remaining: Math.max(0, total - paid),
    currency: c,
  };
}

export function derivePaymentStripSummaryForPayload(
  data: DealWorkspacePayload,
): PaymentStripSummary {
  const ms = getEffectivePaymentMilestones(data);
  if (ms.length === 0) {
    return {
      done: 0,
      total: 0,
      label: "Оплата: віхи не задані",
      variant: "empty",
    };
  }
  const done = ms.filter((m) => m.done).length;
  const total = ms.length;
  if (done === 0) {
    return {
      done,
      total,
      label: `Оплата: 0 / ${total} віх`,
      variant: "unpaid",
    };
  }
  if (done === total) {
    return {
      done,
      total,
      label: `Оплата: всі віхи (${total})`,
      variant: "complete",
    };
  }
  return {
    done,
    total,
    label: `Оплата: ${done} / ${total} віх`,
    variant: "partial",
  };
}
