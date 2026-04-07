import { differenceInCalendarDays } from "date-fns";
import type { LeadDetailRow } from "../../features/leads/queries";
import {
  computeLeadReadiness,
  evaluateLeadChecksForStage,
  getStageConfig,
  mapLeadDetailRowToCoreInput,
} from "../crm-core";
import { leadResponseStatus } from "./lead-row-meta";
import { normalizePhoneDigits } from "./phone-normalize";

export type LeadReadinessLevel = "ready" | "soft" | "attention";

export type LeadReadinessItem = {
  key: string;
  label: string;
  ok: boolean;
};

export type LeadReadinessSnapshot = {
  level: LeadReadinessLevel;
  headline: string;
  items: LeadReadinessItem[];
};

/**
 * Картка готовності / кваліфікації в Lead Hub — узгоджено з CRM Core.
 */
export function computeLeadHubReadinessFromDetail(
  lead: LeadDetailRow,
): LeadReadinessSnapshot {
  const input = mapLeadDetailRowToCoreInput(lead);
  const cfg = getStageConfig(input.stageKey);
  const { required, soft } = evaluateLeadChecksForStage(
    input,
    cfg.requiredChecks,
    cfg.softChecks,
  );
  const checklist = [...required, ...soft].map((c) => ({
    key: c.id,
    label: c.labelUa,
    ok: c.pass,
  }));

  const r = computeLeadReadiness(input);
  let level: LeadReadinessLevel;
  if (r.level === "ready") level = "ready";
  else if (r.level === "partial") level = "soft";
  else level = "attention";

  const phone =
    lead.contact?.phone?.trim() || lead.phone?.trim() || null;
  const email =
    lead.contact?.email?.trim() || lead.email?.trim() || null;
  const hasPhoneOrEmail = Boolean(
    normalizePhoneDigits(phone).length >= 9 ||
      (email && email.length > 3),
  );
  const meta = {
    id: lead.id,
    phone,
    nextStep: lead.nextStep,
    nextContactAt: lead.nextContactAt,
    lastActivityAt: lead.lastActivityAt,
    createdAt: lead.createdAt,
    stage: lead.stage,
  };
  const response = leadResponseStatus(meta);
  const noResponseRisk = response.key === "OVERDUE_TOUCH";
  const daysSinceActivity = lead.lastActivityAt
    ? differenceInCalendarDays(new Date(), new Date(lead.lastActivityAt))
    : null;

  let headline = r.headlineUa;
  if (noResponseRisk || (daysSinceActivity != null && daysSinceActivity > 5)) {
    if (level === "ready") {
      level = "soft";
      headline =
        "Можна конвертувати — перевірте актуальність контакту";
    }
  }

  if (!hasPhoneOrEmail && level === "ready") {
    level = "attention";
  }

  return {
    level,
    headline,
    items: checklist,
  };
}
