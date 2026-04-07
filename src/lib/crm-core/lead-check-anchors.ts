import type { LeadCheckId } from "./lead-stage.types";

/** Якір секції на Lead Hub для переходу до поля, що блокує. */
export const LEAD_CHECK_HUB_ANCHOR: Partial<Record<LeadCheckId, string>> = {
  source_set: "lead-readiness",
  contact_channel: "lead-contact",
  owner_assigned: "lead-contact",
  needs_summary: "lead-readiness",
  furniture_or_object_type: "lead-readiness",
  next_step_text: "lead-next-action",
  next_contact_date: "lead-next-action",
  measurement_decision_recorded: "lead-readiness",
  measurement_scheduled_or_done: "lead-meetings",
  site_address_or_context: "lead-readiness",
  measurement_notes_or_sheet: "lead-files",
  estimate_exists: "lead-commercial",
  active_estimate: "lead-commercial",
  proposal_draft_linked: "lead-commercial",
  proposal_sent: "lead-commercial",
  follow_up_scheduled: "lead-next-action",
  proposal_approved: "lead-commercial",
  approved_amount_documented: "lead-commercial",
  budget_range_documented: "lead-readiness",
  key_files_present: "lead-files",
};

export function hubAnchorHref(anchor: string): string {
  return `#${anchor}`;
}
