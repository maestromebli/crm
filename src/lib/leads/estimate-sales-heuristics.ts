import type { LeadDetailRow } from "../../features/leads/queries";

/** Короткі підказки під блоком комерції (без LLM). */
export function deriveCommercialMicroHints(lead: LeadDetailRow): string[] {
  const hints: string[] = [];
  const lp = lead.proposals[0];
  if (lp?.status === "SENT" || lp?.status === "CLIENT_REVIEWING") {
    hints.push("КП у клієнта — зафіксуйте відповідь у стрічці.");
  }
  if (lp?.status === "REJECTED") {
    hints.push("КП відхилено — оновіть смету та нову версію КП.");
  }
  if (lead.proposals.length >= 2) {
    hints.push("Є кілька версій КП — актуальна зверху (за номером версії).");
  }
  if (lead.estimates.length >= 2) {
    hints.push(
      "Кілька версій смети — зміни в замовленні нормальні; орієнтуйтесь на останню версію.",
    );
  }
  const latest = lead.estimates[0];
  if (latest && latest.totalPrice == null) {
    hints.push("Підсумкова сума не задана — уточніть, щоб звіряти з бюджетом.");
  }
  return hints.slice(0, 3);
}
