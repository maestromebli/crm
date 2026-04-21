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
  proposal_approved: "APPROVED",
  quote_approved: "APPROVED",
  kp_approved: "APPROVED",
  agreed: "APPROVED",
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

function normalizeStageToken(v: string | null | undefined): string {
  if (!v || typeof v !== "string") return "";
  return v.trim().toLowerCase();
}

export function resolveLeadStageKey(
  slug: string | null | undefined,
  opts?: { isFinal?: boolean; finalType?: string | null; stageName?: string | null },
): LeadStageKey {
  const s = normalizeStageToken(slug);
  if (!s) return "UNKNOWN";
  const mapped = SLUG_TO_KEY[s];
  if (mapped) return mapped;
  const name = normalizeStageToken(opts?.stageName);
  if (name.includes("погод") || name.includes("узгод")) return "APPROVED";
  if (name.includes("кп") && name.includes("надісл")) return "QUOTE_SENT";
  if (name.includes("чернет") && name.includes("кп")) return "QUOTE_DRAFT";
  if (name.includes("розрах")) return "CALCULATION";
  if (name.includes("замір")) return "MEASUREMENT";
  if (name.includes("контакт")) return "CONTACT";
  if (name.includes("замовлення")) return "DEAL";
  if (opts?.isFinal) {
    if (opts.finalType === "LOST") return "LOST";
    return "ARCHIVED";
  }
  return "UNKNOWN";
}

export function isTerminalStageKey(key: LeadStageKey): boolean {
  return key === "LOST" || key === "ARCHIVED";
}
