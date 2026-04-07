import type { LeadStageKey } from "./lead-stage.types";

/**
 * Maps DB `PipelineStage.slug` (and legacy journey slugs) to canonical `LeadStageKey`.
 * Unknown slugs → UNKNOWN (callers may still show raw stage name).
 */
const SLUG_TO_KEY: Record<string, LeadStageKey> = {
  new: "NEW",
  working: "CONTACT",
  contact: "CONTACT",
  qualification: "CONTACT",
  measurement: "MEASUREMENT",
  site_visit: "MEASUREMENT",
  estimating: "CALCULATION",
  calculation: "CALCULATION",
  quote_draft: "QUOTE_DRAFT",
  proposal_draft: "QUOTE_DRAFT",
  quote_sent: "QUOTE_SENT",
  proposal_sent: "QUOTE_SENT",
  negotiating: "QUOTE_SENT",
  approved: "APPROVED",
  ready_convert: "APPROVED",
  /** Seed/legacy slug «Кваліфікований» у демо-воронці — відповідає етапу розрахунку, не погодженому КП. */
  qualified: "CALCULATION",
  client: "CLIENT",
  clients: "CLIENT",
  control_measurement: "CONTROL_MEASUREMENT",
  contract: "CONTRACT",
  deal: "DEAL",
  production_ready: "PRODUCTION_READY",
  handoff_ready: "PRODUCTION_READY",
  lost: "LOST",
  archived: "ARCHIVED",
};

export function resolveLeadStageKey(
  slug: string | null | undefined,
  opts?: { isFinal?: boolean; finalType?: string | null },
): LeadStageKey {
  if (!slug || typeof slug !== "string") return "UNKNOWN";
  const s = slug.trim().toLowerCase();
  const mapped = SLUG_TO_KEY[s];
  if (mapped) return mapped;
  if (opts?.isFinal) {
    if (opts.finalType === "LOST") return "LOST";
    return "ARCHIVED";
  }
  return "UNKNOWN";
}

export function isTerminalStageKey(key: LeadStageKey): boolean {
  return key === "LOST" || key === "ARCHIVED";
}
