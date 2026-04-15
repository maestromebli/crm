import type { WorkflowChecklist } from "@/lib/checklists/resolver";

export type WorkflowBlocker = {
  id: string;
  label: string;
  hint: string | null;
  hard: boolean;
};

export type WorkflowBlockerSnapshot = {
  hard: WorkflowBlocker[];
  soft: WorkflowBlocker[];
};

const CLIENT_NEEDS_BLOCKER_IDS = new Set([
  "needs_summary",
  "furniture_or_object_type",
  "budget_range_documented",
]);

export function resolveBlockers(checklist: WorkflowChecklist): WorkflowBlockerSnapshot {
  const isClientNeeds = (id: string) => CLIENT_NEEDS_BLOCKER_IDS.has(id);

  const hard = checklist.items
    .filter(
      (item) =>
        item.severity === "required" &&
        item.state !== "ready" &&
        !isClientNeeds(item.id),
    )
    .map((item) => ({
      id: item.id,
      label: item.label,
      hint: item.hint,
      hard: true,
    }));

  const soft = checklist.items
    .filter(
      (item) =>
        (item.severity === "recommended" || isClientNeeds(item.id)) &&
        item.state !== "ready",
    )
    .map((item) => ({
      id: item.id,
      label: item.label,
      hint: item.hint,
      hard: false,
    }));

  return { hard, soft };
}
