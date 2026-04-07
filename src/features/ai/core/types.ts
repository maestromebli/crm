/**
 * Типізовані контракти для операційного шару ШІ (не чат).
 */

export const AI_OPERATIONS = [
  "lead_summary",
  "lead_next_step",
  "lead_follow_up",
  "lead_risk_explain",
  "proposal_intro",
  "deal_summary",
  "deal_readiness",
  "dashboard_brief",
] as const;

export type AiOperationId = (typeof AI_OPERATIONS)[number];

export type FollowUpTone = "neutral" | "friendly" | "formal";

export type AiOperationRequest = {
  operation: AiOperationId;
  leadId?: string;
  dealId?: string;
  /** Для dashboard_brief — нормалізований JSON з сервера (в межах прав). */
  dashboardContext?: string;
  tone?: FollowUpTone;
};

export type LeadSummaryResult = {
  shortSummary: string;
  whatMattersNow: string;
  blockers: string[];
  nextSteps: string[];
};

export type LeadNextStepResult = {
  recommendedAction: string;
  rationale: string;
  checklist: string[];
};

export type LeadFollowUpResult = {
  shortVersion: string;
  detailedVersion: string;
  ctaSuggestion: string;
  tone: FollowUpTone;
};

export type LeadRiskExplainResult = {
  riskLevel: "low" | "medium" | "high";
  explanation: string;
  whatToDo: string[];
};

export type ProposalIntroResult = {
  introParagraph: string;
  bullets: string[];
  readinessNote: string;
};

export type DealSummaryResult = {
  headline: string;
  situation: string;
  blockers: string[];
  suggestedMoves: string[];
};

export type DealReadinessResult = {
  ready: boolean;
  summary: string;
  blockers: string[];
  recommendedActions: string[];
};

export type DashboardBriefResult = {
  priorities: string[];
  urgentItems: string[];
  risks: string[];
  managerActions: string[];
};

export type AiOperationSuccess =
  | {
      ok: true;
      operation: "lead_summary";
      configured: boolean;
      result: LeadSummaryResult;
    }
  | {
      ok: true;
      operation: "lead_next_step";
      configured: boolean;
      result: LeadNextStepResult;
    }
  | {
      ok: true;
      operation: "lead_follow_up";
      configured: boolean;
      result: LeadFollowUpResult;
    }
  | {
      ok: true;
      operation: "lead_risk_explain";
      configured: boolean;
      result: LeadRiskExplainResult;
    }
  | {
      ok: true;
      operation: "proposal_intro";
      configured: boolean;
      result: ProposalIntroResult;
    }
  | {
      ok: true;
      operation: "deal_summary";
      configured: boolean;
      result: DealSummaryResult;
    }
  | {
      ok: true;
      operation: "deal_readiness";
      configured: boolean;
      result: DealReadinessResult;
    }
  | {
      ok: true;
      operation: "dashboard_brief";
      configured: boolean;
      result: DashboardBriefResult;
    };

export type AiOperationFailure = {
  ok: false;
  error: string;
  status: number;
};

export type AiOperationResponse = AiOperationSuccess | AiOperationFailure;
