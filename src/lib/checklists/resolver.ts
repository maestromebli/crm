import type { DealWorkspacePayload } from "@/features/deal-workspace/types";
import {
  evaluateLeadChecksForStage,
  getStageConfig,
  type LeadCoreInput,
} from "@/lib/crm-core";

export type WorkflowChecklistSeverity = "required" | "recommended";
export type WorkflowChecklistState = "ready" | "partial" | "missing";

export type WorkflowChecklistItem = {
  id: string;
  label: string;
  state: WorkflowChecklistState;
  severity: WorkflowChecklistSeverity;
  hint: string | null;
  source: "lead_core" | "deal_workspace";
};

export type WorkflowChecklist = {
  items: WorkflowChecklistItem[];
  totalCount: number;
  readyCount: number;
  progressPercent: number;
};

function progress(items: WorkflowChecklistItem[]): WorkflowChecklist {
  const totalCount = items.length;
  const readyCount = items.filter((item) => item.state === "ready").length;
  const progressPercent =
    totalCount === 0 ? 100 : Math.round((readyCount / totalCount) * 100);
  return { items, totalCount, readyCount, progressPercent };
}

export function resolveLeadChecklist(lead: LeadCoreInput): WorkflowChecklist {
  const cfg = getStageConfig(lead.stageKey);
  const checks = evaluateLeadChecksForStage(lead, cfg.requiredChecks, cfg.softChecks);
  const items: WorkflowChecklistItem[] = [
    ...checks.required.map((item) => ({
      id: item.id,
      label: item.labelUa,
      state: (item.pass ? "ready" : "missing") as WorkflowChecklistState,
      severity: "required" as WorkflowChecklistSeverity,
      hint: item.hintUa ?? null,
      source: "lead_core" as WorkflowChecklistItem["source"],
    })),
    ...checks.soft.map((item) => ({
      id: item.id,
      label: item.labelUa,
      state: (item.pass ? "ready" : "partial") as WorkflowChecklistState,
      severity: "recommended" as WorkflowChecklistSeverity,
      hint: item.hintUa ?? null,
      source: "lead_core" as WorkflowChecklistItem["source"],
    })),
  ];
  return progress(items);
}

export function resolveDealChecklist(data: DealWorkspacePayload): WorkflowChecklist {
  const items: WorkflowChecklistItem[] = data.readiness.map((item) => ({
    id: item.id,
    label: item.label,
    state: (item.done ? "ready" : "missing") as WorkflowChecklistState,
    severity: "required" as WorkflowChecklistSeverity,
    hint: item.blockerMessage ?? null,
    source: "deal_workspace" as WorkflowChecklistItem["source"],
  }));
  return progress(items);
}
