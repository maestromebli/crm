import { LEAD_FUNNEL_LINEAR } from "./lead-flow-engine";
import type { LeadCoreInput } from "./lead-input.types";
import { computeLeadReadiness } from "./lead-readiness";
import { getStageConfig } from "./lead-stage.config";
import type { LeadStageKey } from "./lead-stage.types";
import { isTerminalStageKey } from "./lead-stage-resolve";

export type LeadFunnelPanelRow = {
  key: LeadStageKey;
  labelUa: string;
  state: "done" | "current" | "upcoming";
};

/** Етапи для лівої панелі ліда (без «готовності до виробництва» — це вже угода). */
const PANEL_ORDER: LeadStageKey[] = LEAD_FUNNEL_LINEAR.filter(
  (k) => k !== "PRODUCTION_READY",
) as LeadStageKey[];
const STAGES_BEFORE_APPROVED: ReadonlySet<LeadStageKey> = new Set([
  "CALCULATION",
  "QUOTE_DRAFT",
  "QUOTE_SENT",
]);

function normalizeStageForPanel(stage: LeadStageKey): LeadStageKey {
  if (stage === "PRODUCTION_READY") return "DEAL";
  if (
    stage === "CLIENT" ||
    stage === "CONTROL_MEASUREMENT" ||
    stage === "CONTRACT"
  ) {
    return "APPROVED";
  }
  return stage;
}

function hasApprovedProposal(core: LeadCoreInput): boolean {
  if (core.projectAgreed) return true;
  return core.commercial.proposals.some((p) => {
    const status = p.status.toLowerCase();
    return Boolean(p.approvedAt) || status.includes("approv") || status.includes("погод");
  });
}

function resolveCurrentPanelStage(core: LeadCoreInput): LeadStageKey {
  const normalized = normalizeStageForPanel(core.stageKey);
  if (!STAGES_BEFORE_APPROVED.has(normalized)) return normalized;
  return hasApprovedProposal(core) ? "APPROVED" : normalized;
}

/**
 * Рядки для візуальної панелі етапів (зв’язок із Flow Engine / канонічними ключами).
 */
export function buildLeadFunnelPanelRows(core: LeadCoreInput): LeadFunnelPanelRow[] {
  const cur = resolveCurrentPanelStage(core);
  if (isTerminalStageKey(cur)) {
    return [
      {
        key: cur,
        labelUa: getStageConfig(cur).labelUa,
        state: "current",
      },
    ];
  }

  const idx = PANEL_ORDER.indexOf(cur);
  return PANEL_ORDER.map((key, i) => {
    let state: LeadFunnelPanelRow["state"];
    if (idx < 0) {
      state = i === 0 ? "current" : "upcoming";
    } else if (i < idx) state = "done";
    else if (i === idx) state = "current";
    else state = "upcoming";

    return {
      key,
      labelUa: getStageConfig(key).labelUa,
      state,
    };
  });
}

export function funnelCurrentBlockerHint(core: LeadCoreInput): string | null {
  const r = computeLeadReadiness(core);
  if (r.level === "ready") return null;
  const first = r.blockers[0];
  return first ? first.hintUa ?? first.labelUa : null;
}
