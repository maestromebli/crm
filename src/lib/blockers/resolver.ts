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

export function resolveBlockers(checklist: WorkflowChecklist): WorkflowBlockerSnapshot {
  const hard = checklist.items
    .filter((item) => item.severity === "required" && item.state !== "ready")
    .map((item) => ({
      id: item.id,
      label: item.label,
      hint: item.hint,
      hard: true,
    }));

  const soft = checklist.items
    .filter(
      (item) => item.severity === "recommended" && item.state !== "ready",
    )
    .map((item) => ({
      id: item.id,
      label: item.label,
      hint: item.hint,
      hard: false,
    }));

  return { hard, soft };
}
