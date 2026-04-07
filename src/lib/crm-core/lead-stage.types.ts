/** Canonical lead funnel keys (ENVER). DB slugs map via `resolveLeadStageKey`. */
export type LeadStageKey =
  | "NEW"
  | "CONTACT"
  | "MEASUREMENT"
  | "CALCULATION"
  | "QUOTE_DRAFT"
  | "QUOTE_SENT"
  | "APPROVED"
  | "CLIENT"
  | "CONTROL_MEASUREMENT"
  | "CONTRACT"
  | "DEAL"
  | "PRODUCTION_READY"
  | "LOST"
  | "ARCHIVED"
  | "UNKNOWN";

/** High-level grouping for dashboards / filters. */
export type LeadStageGroup =
  | "intake"
  | "qualification"
  | "site_work"
  | "pricing"
  | "proposal"
  | "closing"
  | "handoff"
  | "terminal";

export type LeadStageGroupDefinition = {
  key: LeadStageGroup;
  labelUa: string;
};

export type LeadCtaSeverity = "primary" | "secondary" | "warning";

export type LeadCtaActionKey =
  | "contact_client"
  | "qualify"
  | "schedule_measurement"
  | "open_estimate"
  | "create_proposal"
  | "send_proposal"
  | "schedule_followup"
  | "convert_to_deal"
  | "open_client_card"
  | "schedule_control_measurement"
  | "open_contract"
  | "open_deal"
  | "confirm_production_ready"
  | "review_stalled";

export type LeadDominantCta = {
  labelUa: string;
  actionKey: LeadCtaActionKey;
  severity: LeadCtaSeverity;
  /** Path pattern with `:leadId` / `:dealId` placeholders. */
  routePattern: string | null;
  /** Готовий шлях після підстановки id, якщо застосовно. */
  route: string | null;
  anchorSection: string | null;
  disabled: boolean;
  reasonUa: string | null;
};

export type LeadCheckKind = "required" | "soft";

export type LeadCheckId =
  | "source_set"
  | "contact_channel"
  | "owner_assigned"
  | "needs_summary"
  | "furniture_or_object_type"
  | "next_step_text"
  | "next_contact_date"
  | "measurement_decision_recorded"
  | "measurement_scheduled_or_done"
  | "site_address_or_context"
  | "measurement_notes_or_sheet"
  | "estimate_exists"
  | "active_estimate"
  | "proposal_draft_linked"
  | "proposal_sent"
  | "follow_up_scheduled"
  | "proposal_approved"
  | "approved_amount_documented"
  | "budget_range_documented"
  | "key_files_present";

export type LeadCheckResult = {
  id: LeadCheckId;
  kind: LeadCheckKind;
  pass: boolean;
  labelUa: string;
  hintUa: string | null;
};

export type CoreReadinessLevel = "ready" | "partial" | "blocked";

export type LeadReadinessResult = {
  level: CoreReadinessLevel;
  headlineUa: string;
  items: LeadReadinessItemResult[];
  blockers: LeadCheckResult[];
  softWarnings: LeadCheckResult[];
};

export type LeadReadinessItemResult = {
  key: string;
  labelUa: string;
  state: "ready" | "partial" | "missing";
  hintUa: string | null;
};

export type TransitionValidationResult = {
  ok: boolean;
  errors: Array<{ code: string; messageUa: string }>;
  warnings: Array<{ code: string; messageUa: string }>;
  missingRequirements: LeadCheckId[];
};

export type ConversionGateResult = {
  ok: boolean;
  errors: Array<{ code: string; messageUa: string }>;
  warnings: Array<{ code: string; messageUa: string }>;
};

export type LeadRiskFlag =
  | "no_response_sla"
  | "stale_no_activity"
  | "no_owner"
  | "no_next_step"
  | "no_estimate"
  | "quote_sent_no_followup"
  | "approved_without_snapshot"
  | "measurement_done_no_estimate"
  | "contact_incomplete";

export type LeadRiskResult = {
  flags: LeadRiskFlag[];
  items: Array<{ flag: LeadRiskFlag; messageUa: string; severity: "high" | "medium" | "low" }>;
};

export type LeadAiHint = {
  id: string;
  textUa: string;
  priority: number;
};

export type LeadRiskProfileTag =
  | "early_funnel"
  | "site_visit"
  | "pricing"
  | "negotiation"
  | "closing"
  | "handoff"
  | "terminal";
