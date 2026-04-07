import { getStageConfig } from "./lead-stage.config";
import { isTerminalStageKey } from "./lead-stage-resolve";
import type { LeadCoreInput } from "./lead-input.types";
import type { LeadDominantCta, LeadCtaSeverity } from "./lead-stage.types";

function resolveRoute(
  pattern: string | null,
  lead: LeadCoreInput,
): string | null {
  if (!pattern) return null;
  let out = pattern.replace(":leadId", lead.id);
  if (out.includes(":dealId")) {
    if (!lead.dealId) return null;
    out = out.replace(":dealId", lead.dealId);
  }
  return out;
}

function severityForStage(key: import("./lead-stage.types").LeadStageKey): LeadCtaSeverity {
  if (key === "APPROVED" || key === "PRODUCTION_READY") return "primary";
  if (key === "QUOTE_SENT" || key === "LOST") return "warning";
  return "secondary";
}

function contactStageCta(lead: LeadCoreInput): LeadDominantCta | null {
  if (lead.stageKey !== "CONTACT") return null;
  const md = lead.qualification.measurementDecision;
  const toCalculation = md === "skipped" || md === "completed";

  if (toCalculation) {
    const routePattern = "/leads/:leadId/pricing";
    return {
      labelUa: "Перейти до розрахунку",
      actionKey: "open_estimate",
      severity: "primary",
      routePattern,
      anchorSection: null,
      route: resolveRoute(routePattern, lead),
      disabled: false,
      reasonUa: null,
    };
  }

  const routePattern = "/leads/:leadId";
  return {
    labelUa: "Запланувати замір",
    actionKey: "schedule_measurement",
    severity: "primary",
    routePattern,
    anchorSection: "meetings",
    route: resolveRoute(routePattern, lead),
    disabled: false,
    reasonUa: null,
  };
}

/**
 * Домінантний CTA для поточної стадії (один на екран).
 */
export function getLeadDominantNextStep(lead: LeadCoreInput): LeadDominantCta {
  const contactOverride = contactStageCta(lead);
  if (contactOverride) {
    return contactOverride;
  }

  const cfg = getStageConfig(lead.stageKey);
  const base = cfg.dominantCta;
  const route = resolveRoute(base.routePattern, lead);

  if (isTerminalStageKey(lead.stageKey)) {
    return {
      labelUa: base.labelUa,
      actionKey: base.actionKey,
      severity: "secondary",
      routePattern: base.routePattern,
      anchorSection: base.anchorSection,
      route,
      disabled: false,
      reasonUa: null,
    };
  }

  let disabled = false;
  let reasonUa: string | null = null;

  if (
    (base.actionKey === "open_contract" ||
      base.actionKey === "confirm_production_ready" ||
      base.actionKey === "open_deal") &&
    !lead.dealId
  ) {
    disabled = true;
    reasonUa = "Спочатку створіть угоду з ліда";
  }

  if (base.actionKey === "create_proposal" && !lead.commercial.activeEstimateId) {
    disabled = true;
    reasonUa = "Оберіть активну версію смети";
  }

  return {
    labelUa: base.labelUa,
    actionKey: base.actionKey,
    severity: severityForStage(lead.stageKey),
    routePattern: base.routePattern,
    anchorSection: base.anchorSection,
    route: disabled ? null : route,
    disabled,
    reasonUa,
  };
}
