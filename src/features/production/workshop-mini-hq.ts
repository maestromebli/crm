import type { ProductionTaskStatus } from "./types/production";

export const MINI_HQ_STAGE_KEYS = ["CUTTING", "EDGING", "DRILLING", "ASSEMBLY"] as const;
export type MiniHqStageKey = (typeof MINI_HQ_STAGE_KEYS)[number];

export const MINI_HQ_PAUSE_REASONS = [
  { code: "MATERIAL_WAIT", label: "Очікування матеріалу" },
  { code: "MACHINE_SERVICE", label: "Обслуговування обладнання" },
  { code: "QUALITY_REWORK", label: "Доопрацювання після контролю якості" },
  { code: "DRAWING_CLARIFICATION", label: "Уточнення креслень" },
  { code: "TEAM_REBALANCE", label: "Перерозподіл бригади" },
  { code: "OTHER", label: "Інша причина" },
] as const;

export type MiniHqPauseReasonCode = (typeof MINI_HQ_PAUSE_REASONS)[number]["code"];

export type MiniHqLifecycleState = "IDLE" | "RUNNING" | "PAUSED" | "DONE";

export type MiniHqLifecycle = {
  state: MiniHqLifecycleState;
  startedAt: string | null;
  completedAt: string | null;
  lastResumedAt: string | null;
  lastPausedAt: string | null;
  activeSeconds: number;
  pauseReasonCode: MiniHqPauseReasonCode | null;
  pauseComment: string | null;
};

export type MiniHqProgressSource = "gitlab" | "manual" | "none";

export type MiniHqProgress = {
  percent: number;
  source: MiniHqProgressSource;
  stageMetricKey: string | null;
  stageMetricActual: number | null;
  stageMetricPlan: number | null;
  lastSyncedAt: string | null;
  lastError: string | null;
};

export type MiniHqGitLabBinding = {
  projectId: string | null;
  ref: string | null;
  path: string | null;
};

export type MiniHqTaskState = {
  lifecycle: MiniHqLifecycle;
  progress: MiniHqProgress;
  gitlab: MiniHqGitLabBinding;
};

export type MiniHqTreeNodeType = "folder" | "file";

export type MiniHqTreeNode = {
  id: string;
  parentId: string | null;
  type: MiniHqTreeNodeType;
  name: string;
  stageKey: MiniHqStageKey | null;
  gitlabProjectId: string | null;
  gitlabRef: string | null;
  gitlabPath: string | null;
  gitlabWebUrl: string | null;
};

const pauseReasonSet = new Set<string>(MINI_HQ_PAUSE_REASONS.map((x) => x.code));
const stageSet = new Set<string>(MINI_HQ_STAGE_KEYS);

function toIso(raw: unknown): string | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function toNonNegativeNumber(raw: unknown): number {
  if (typeof raw !== "number" || !Number.isFinite(raw)) return 0;
  if (raw <= 0) return 0;
  return raw;
}

function clampPercent(raw: unknown): number {
  if (typeof raw !== "number" || !Number.isFinite(raw)) return 0;
  if (raw <= 0) return 0;
  if (raw >= 100) return 100;
  return Math.round(raw);
}

function inferStateFromTaskStatus(taskStatus: ProductionTaskStatus): MiniHqLifecycleState {
  if (taskStatus === "DONE") return "DONE";
  if (taskStatus === "IN_PROGRESS") return "RUNNING";
  if (taskStatus === "BLOCKED") return "PAUSED";
  return "IDLE";
}

function createDefaultLifecycle(taskStatus: ProductionTaskStatus): MiniHqLifecycle {
  return {
    state: inferStateFromTaskStatus(taskStatus),
    startedAt: null,
    completedAt: null,
    lastResumedAt: null,
    lastPausedAt: null,
    activeSeconds: 0,
    pauseReasonCode: null,
    pauseComment: null,
  };
}

function createDefaultProgress(): MiniHqProgress {
  return {
    percent: 0,
    source: "none",
    stageMetricKey: null,
    stageMetricActual: null,
    stageMetricPlan: null,
    lastSyncedAt: null,
    lastError: null,
  };
}

function normalizePauseReason(raw: unknown): MiniHqPauseReasonCode | null {
  if (typeof raw !== "string") return null;
  if (!pauseReasonSet.has(raw)) return null;
  return raw as MiniHqPauseReasonCode;
}

export function normalizeMiniHqTaskState(raw: unknown, taskStatus: ProductionTaskStatus): MiniHqTaskState {
  const payload =
    raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const lifecycleRaw =
    payload.lifecycle && typeof payload.lifecycle === "object" && !Array.isArray(payload.lifecycle)
      ? (payload.lifecycle as Record<string, unknown>)
      : {};
  const progressRaw =
    payload.progress && typeof payload.progress === "object" && !Array.isArray(payload.progress)
      ? (payload.progress as Record<string, unknown>)
      : {};
  const gitlabRaw =
    payload.gitlab && typeof payload.gitlab === "object" && !Array.isArray(payload.gitlab)
      ? (payload.gitlab as Record<string, unknown>)
      : {};

  const defaultLifecycle = createDefaultLifecycle(taskStatus);
  const lifecycle: MiniHqLifecycle = {
    state:
      lifecycleRaw.state === "IDLE" ||
      lifecycleRaw.state === "RUNNING" ||
      lifecycleRaw.state === "PAUSED" ||
      lifecycleRaw.state === "DONE"
        ? lifecycleRaw.state
        : defaultLifecycle.state,
    startedAt: toIso(lifecycleRaw.startedAt),
    completedAt: toIso(lifecycleRaw.completedAt),
    lastResumedAt: toIso(lifecycleRaw.lastResumedAt),
    lastPausedAt: toIso(lifecycleRaw.lastPausedAt),
    activeSeconds: Math.floor(toNonNegativeNumber(lifecycleRaw.activeSeconds)),
    pauseReasonCode: normalizePauseReason(lifecycleRaw.pauseReasonCode),
    pauseComment: typeof lifecycleRaw.pauseComment === "string" ? lifecycleRaw.pauseComment.trim() || null : null,
  };

  const progress: MiniHqProgress = {
    ...createDefaultProgress(),
    percent: clampPercent(progressRaw.percent),
    source:
      progressRaw.source === "gitlab" || progressRaw.source === "manual" || progressRaw.source === "none"
        ? progressRaw.source
        : "none",
    stageMetricKey: typeof progressRaw.stageMetricKey === "string" ? progressRaw.stageMetricKey : null,
    stageMetricActual:
      typeof progressRaw.stageMetricActual === "number" && Number.isFinite(progressRaw.stageMetricActual)
        ? progressRaw.stageMetricActual
        : null,
    stageMetricPlan:
      typeof progressRaw.stageMetricPlan === "number" && Number.isFinite(progressRaw.stageMetricPlan)
        ? progressRaw.stageMetricPlan
        : null,
    lastSyncedAt: toIso(progressRaw.lastSyncedAt),
    lastError: typeof progressRaw.lastError === "string" ? progressRaw.lastError : null,
  };

  const gitlab: MiniHqGitLabBinding = {
    projectId: typeof gitlabRaw.projectId === "string" ? gitlabRaw.projectId.trim() || null : null,
    ref: typeof gitlabRaw.ref === "string" ? gitlabRaw.ref.trim() || null : null,
    path: typeof gitlabRaw.path === "string" ? gitlabRaw.path.trim() || null : null,
  };

  return { lifecycle, progress, gitlab };
}

export function computeActiveSecondsWithNow(lifecycle: MiniHqLifecycle, nowIso: string): number {
  const base = Math.floor(toNonNegativeNumber(lifecycle.activeSeconds));
  if (lifecycle.state !== "RUNNING" || !lifecycle.lastResumedAt) return base;
  const from = new Date(lifecycle.lastResumedAt).getTime();
  const to = new Date(nowIso).getTime();
  if (Number.isNaN(from) || Number.isNaN(to) || to <= from) return base;
  return base + Math.floor((to - from) / 1000);
}

export function normalizeMiniHqTree(raw: unknown): MiniHqTreeNode[] {
  if (!Array.isArray(raw)) return [];
  const out: MiniHqTreeNode[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object" || Array.isArray(row)) continue;
    const node = row as Record<string, unknown>;
    const id = typeof node.id === "string" ? node.id.trim() : "";
    const name = typeof node.name === "string" ? node.name.trim() : "";
    if (!id || !name) continue;
    const type = node.type === "folder" ? "folder" : node.type === "file" ? "file" : null;
    if (!type) continue;
    const stageKey =
      typeof node.stageKey === "string" && stageSet.has(node.stageKey) ? (node.stageKey as MiniHqStageKey) : null;
    out.push({
      id,
      parentId: typeof node.parentId === "string" ? node.parentId : null,
      type,
      name,
      stageKey,
      gitlabProjectId: typeof node.gitlabProjectId === "string" ? node.gitlabProjectId : null,
      gitlabRef: typeof node.gitlabRef === "string" ? node.gitlabRef : null,
      gitlabPath: typeof node.gitlabPath === "string" ? node.gitlabPath : null,
      gitlabWebUrl: typeof node.gitlabWebUrl === "string" ? node.gitlabWebUrl : null,
    });
  }
  return out.slice(0, 1000);
}

