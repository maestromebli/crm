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
  blockerActions: {
    id: string;
    label: string;
    href: string;
    aiHref: string | null;
  }[];
  primary: ActionPlan["primary"];
  secondary: ActionPlan["secondary"];
  aiNote: string | null;
};

function leadBlockerHref(leadId: string, blockerId: string): string {
  switch (blockerId) {
    case "contact_channel":
      return `/leads/${leadId}/contact`;
    case "estimate_exists":
    case "active_estimate":
      return `/leads/${leadId}/pricing`;
    case "proposal_draft_linked":
    case "proposal_sent":
    case "proposal_approved":
    case "approved_amount_documented":
      return `/leads/${leadId}/kp`;
    case "measurement_scheduled_or_done":
      return `/leads/${leadId}#lead-meetings`;
    case "key_files_present":
    case "measurement_notes_or_sheet":
      return `/leads/${leadId}/files`;
    default:
      return `/leads/${leadId}#lead-extra`;
  }
}

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
    blockerActions: blockers.hard.map((item) => ({
      id: item.id,
      label: item.hint ?? item.label,
      href: leadBlockerHref(lead.id, item.id),
      aiHref: `/leads/${lead.id}/ai`,
    })),
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
    blockerActions: blockers.hard.map((item) => ({
      id: item.id,
      label: item.hint ?? item.label,
      href:
        actionPlan.primary.kind === "navigate" && actionPlan.primary.href
          ? actionPlan.primary.href
          : "#",
      aiHref: null,
    })),
    primary: actionPlan.primary,
    secondary: actionPlan.secondary.slice(0, 3),
    aiNote: deriveNextBestAction(data),
  };
}
