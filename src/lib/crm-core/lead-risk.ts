import { differenceInCalendarDays } from "date-fns";
import { leadFirstTouchSlaMinutes } from "../leads/lead-sla";
import type { LeadCoreInput } from "./lead-input.types";
import type { LeadRiskFlag, LeadRiskResult } from "./lead-stage.types";
import { isTerminalStageKey } from "./lead-stage-resolve";

const STALE_ACTIVITY_DAYS = 7;
const QUOTE_STALL_DAYS = 5;

function push(
  out: LeadRiskResult,
  flag: LeadRiskFlag,
  messageUa: string,
  severity: "high" | "medium" | "low",
): void {
  out.flags.push(flag);
  out.items.push({ flag, messageUa, severity });
}

/**
 * Евристичні ризики для дашбордів і попереджень (без LLM).
 */
export function computeLeadRisks(lead: LeadCoreInput): LeadRiskResult {
  const out: LeadRiskResult = { flags: [], items: [] };

  if (!lead.ownerAssigned || !lead.ownerId) {
    push(out, "no_owner", "Немає відповідального менеджера", "high");
  }

  if (!lead.contact.hasValidPhoneOrEmail) {
    push(out, "contact_incomplete", "Немає коректного телефону чи email", "high");
  }

  if (
    !lead.nextStepText?.trim() &&
    lead.nextContactAt == null &&
    !isTerminalStageKey(lead.stageKey)
  ) {
    push(out, "no_next_step", "Не зафіксовано наступний крок або дату контакту", "medium");
  }

  if (lead.slaFirstTouchBreached) {
    push(
      out,
      "no_response_sla",
      `Новий лід без дотику понад ${leadFirstTouchSlaMinutes()} хв. (SLA) — ризик втрати звернення`,
      "high",
    );
  }

  if (
    lead.activity.daysSinceActivity != null &&
    lead.activity.daysSinceActivity > STALE_ACTIVITY_DAYS &&
    !isTerminalStageKey(lead.stageKey)
  ) {
    push(
      out,
      "stale_no_activity",
      `Немає активності понад ${STALE_ACTIVITY_DAYS} дн.`,
      "medium",
    );
  }

  if (lead.commercial.estimates.length === 0 && lead.stageKey === "CALCULATION") {
    push(out, "no_estimate", "На етапі розрахунку немає жодної версії смети", "high");
  }

  const prop = lead.commercial.latestProposal;
  if (
    prop &&
    (prop.status === "SENT" || prop.status === "CLIENT_REVIEWING") &&
    lead.nextContactAt == null &&
    prop.sentAt
  ) {
    const sent = new Date(prop.sentAt);
    if (
      !Number.isNaN(sent.getTime()) &&
      differenceInCalendarDays(new Date(), sent) > QUOTE_STALL_DAYS
    ) {
      push(
        out,
        "quote_sent_no_followup",
        "КП надіслано давно — немає дати наступний контакт",
        "medium",
      );
    }
  }

  if (prop?.status === "APPROVED" && !prop.hasSnapshot) {
    push(
      out,
      "approved_without_snapshot",
      "КП погоджено без знімка комерційних умов — перевірте КП",
      "medium",
    );
  }

  if (
    lead.meetings.completedMeasurementCount > 0 &&
    lead.commercial.estimates.length === 0 &&
    lead.stageKey !== "NEW"
  ) {
    push(
      out,
      "measurement_done_no_estimate",
      "Замір виконано, але немає розрахунку",
      "medium",
    );
  }

  return out;
}
