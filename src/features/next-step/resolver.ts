import type { DealWorkspacePayload } from "@/features/deal-workspace/types";
import type { LeadDetailRow } from "@/features/leads/queries";
import { deriveNextBestAction } from "@/lib/deal-core/insights";
import { resolveBlockers } from "@/lib/blockers/resolver";
import {
  buildLeadAiHints,
  getLeadDominantNextStep,
  mapLeadDetailRowToCoreInput,
} from "@/lib/crm-core";
import { resolveDealChecklist, resolveLeadChecklist } from "@/lib/checklists/resolver";
import { resolveDealActionPlan, resolveLeadActionPlan, type ActionPlan } from "@/lib/actions/resolver";

export type NextStepViewModel = {
  title: string;
  explanation: string;
  progressPercent: number;
  blockers: string[];
  primary: ActionPlan["primary"];
  secondary: ActionPlan["secondary"];
  aiNote: string | null;
};

export function resolveLeadNextStep(lead: LeadDetailRow): NextStepViewModel {
  const core = mapLeadDetailRowToCoreInput(lead);
  const checklist = resolveLeadChecklist(core);
  const blockers = resolveBlockers(checklist);
  const actionPlan = resolveLeadActionPlan(core);
  const cta = getLeadDominantNextStep(core);
  const hints = buildLeadAiHints(core);

  return {
    title: cta.labelUa,
    explanation:
      blockers.hard.length > 0
        ? "Головна дія заблокована обов'язковими пунктами чекліста."
        : "Це найкращий наступний крок за поточним станом ліда.",
    progressPercent: checklist.progressPercent,
    blockers: blockers.hard.map((item) => item.hint ?? item.label),
    primary: actionPlan.primary,
    secondary: actionPlan.secondary.slice(0, 3),
    aiNote: hints[0]?.textUa ?? null,
  };
}

export function resolveDealNextStep(data: DealWorkspacePayload): NextStepViewModel {
  const checklist = resolveDealChecklist(data);
  const blockers = resolveBlockers(checklist);
  const actionPlan = resolveDealActionPlan(data);

  return {
    title: actionPlan.primary.label,
    explanation:
      blockers.hard.length > 0
        ? "Перед основною дією потрібно зняти блокери готовності."
        : "Крок підібрано з урахуванням стадії, готовності й комунікацій.",
    progressPercent: checklist.progressPercent,
    blockers: blockers.hard.map((item) => item.hint ?? item.label),
    primary: actionPlan.primary,
    secondary: actionPlan.secondary.slice(0, 3),
    aiNote: deriveNextBestAction(data),
  };
}
