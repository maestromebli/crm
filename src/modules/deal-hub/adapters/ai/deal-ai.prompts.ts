import type { DealAiInput } from "./deal-ai.types";

export function buildDealAiPrompt(input: DealAiInput): string {
  const { overview, kind } = input;
  return [
    `Generate a ${kind} briefing for furniture deal ${overview.deal.code}.`,
    `Stage: ${overview.deal.stageLabel}. Health: ${overview.health.status} (${overview.health.score}).`,
    `Approved total: ${overview.pricing.approvedTotal ?? "n/a"}, paid: ${overview.finance.paidAmount}.`,
    `Top risks: ${overview.risks.map((r) => r.title).join("; ") || "none"}.`,
    "Respond as concise bullet points with blockers and next execution actions.",
  ].join("\n");
}
