import type { DealAiInput } from "./deal-ai.types";

export function buildDealAiPrompt(input: DealAiInput): string {
  const { overview, kind } = input;
  const dealCode = overview.deal.code ?? "без номера";
  return [
    `Generate a ${kind} briefing for furniture deal ${dealCode}.`,
    `Stage: ${overview.deal.stageLabel}. Health: ${overview.стан.status} (${overview.стан.score}).`,
    `Approved total: ${overview.pricing.approvedTotal ?? "n/a"}, paid: ${overview.finance.paidAmount}.`,
    `Top risks: ${overview.risks.map((r) => r.title).join("; ") || "none"}.`,
    "Respond as concise bullet points with blockers and next execution actions.",
  ].join("\n");
}
