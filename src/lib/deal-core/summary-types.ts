/** Payment strip / money summaries for deal workspace (shared by domain + UI warnings). */

export type PaymentStripSummary = {
  done: number;
  total: number;
  label: string;
  variant: "empty" | "unpaid" | "partial" | "complete";
};

export type PaymentMoneySummary = {
  hasNumeric: boolean;
  total: number;
  paid: number;
  remaining: number;
  currency: string | null;
};
