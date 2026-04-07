import type { DealWorkspacePayload } from "../deal-core/workspace-types";
import type { LeadDetailRow } from "../../features/leads/queries";

export type UiVisibilityRules = {
  showMeasurementCalendar: boolean;
  showPartnerPercent: boolean;
};

type VisibilityInput = {
  needsMeasurement: boolean;
  source: string | null;
};

export function resolveUiVisibilityRules(input: VisibilityInput): UiVisibilityRules {
  const normalizedSource = (input.source ?? "").trim().toLowerCase();
  const fromDesigner =
    normalizedSource.includes("designer") ||
    normalizedSource.includes("дизайнер");

  return {
    showMeasurementCalendar: input.needsMeasurement,
    showPartnerPercent: fromDesigner,
  };
}

export function resolveLeadUiVisibilityRules(lead: LeadDetailRow): UiVisibilityRules {
  const stageNeedsMeasurement =
    lead.stage.slug === "measurement" || lead.stage.slug === "control_measurement";
  const missingMeasurementEvent =
    !lead.calendarEvents.some((x) => x.type.toLowerCase().includes("measure"));

  return resolveUiVisibilityRules({
    needsMeasurement: stageNeedsMeasurement && missingMeasurementEvent,
    source: lead.source ?? null,
  });
}

export function resolveDealUiVisibilityRules(data: DealWorkspacePayload): UiVisibilityRules {
  const needsMeasurement = !data.controlMeasurement?.completedAt;
  return resolveUiVisibilityRules({
    needsMeasurement,
    source: null,
  });
}
