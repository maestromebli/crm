"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { KanbanBoardSkeleton } from "@/components/shared/KanbanBoardSkeleton";
import { KanbanEmptyColumn } from "@/components/shared/KanbanEmptyColumn";
import type { ProductionCommandCenterView } from "../../types/production";
import { MINI_HQ_STANDARDS, workshopMaterialsPanelTitle } from "../../workshop-mini-hq-standards";
import { MINI_HQ_PAUSE_REASONS, type MiniHqPauseReasonCode, type MiniHqTreeNode } from "../../workshop-mini-hq";
import {
  buildDefaultMaterialsChecklist,
  defaultScopeForWorkshopStage,
  filterMaterialsForWorkshopStage,
  type WorkshopMaterialCheckItem,
} from "../../workshop-materials";
import {
  WORKSHOP_MINI_HQ_STAGE_KEYS,
  WORKSHOP_STAGE_LABEL_UK,
  parseWorkshopStageParam,
  workshopStageHref,
  type WorkshopKanbanStageKey,
} from "../../workshop-stages";
import { patchJson, postJson } from "@/lib/api/patch-json";
import { tryReadResponseJson } from "@/lib/http/read-response-json";

type KanbanColumn = ProductionCommandCenterView["workshopKanban"][number];
type WorkshopTask = KanbanColumn["tasks"][number];
type WorkshopStageKey = KanbanColumn["stageKey"];

type AssigneeOption = { id: string; name: string | null; email: string | null; role: string };

const PRIORITY_RANK: Record<WorkshopTask["priority"], number> = {
  URGENT: 0,
  HIGH: 1,
  NORMAL: 2,
  LOW: 3,
};

/** Прострочені та найближчі дедлайни зверху, далі — пріоритет. */
function sortWorkshopTasks(tasks: WorkshopTask[], nowMs: number): WorkshopTask[] {
  return [...tasks].sort((a, b) => {
    const ta = a.dueDate ? new Date(a.dueDate).getTime() : Number.POSITIVE_INFINITY;
    const tb = b.dueDate ? new Date(b.dueDate).getTime() : Number.POSITIVE_INFINITY;
    const aOver = a.dueDate != null && ta < nowMs;
    const bOver = b.dueDate != null && tb < nowMs;
    if (aOver !== bOver) return aOver ? -1 : 1;
    if (ta !== tb) return ta - tb;
    return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
  });
}

function dueLine(iso: string | null, nowMs: number): { text: string; overdue: boolean; soon: boolean } {
  if (!iso) return { text: "", overdue: false, soon: false };
  const end = new Date(iso).getTime();
  const d = Math.ceil((end - nowMs) / (24 * 60 * 60 * 1000));
  if (d < 0) return { text: `прострочено ${Math.abs(d)} дн.`, overdue: true, soon: false };
  if (d === 0) return { text: "дедлайн сьогодні", overdue: false, soon: true };
  if (d <= 3) return { text: `здача через ${d} дн.`, overdue: false, soon: true };
  return { text: `до ${iso.slice(0, 10)}`, overdue: false, soon: false };
}

function displayName(u: AssigneeOption): string {
  return u.name?.trim() || u.email?.trim() || u.id;
}

function newMaterialId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `m-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function formatSeconds(totalSeconds: number): string {
  const safe = Number.isFinite(totalSeconds) ? Math.max(0, Math.floor(totalSeconds)) : 0;
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function sortedTree(nodes: MiniHqTreeNode[]): MiniHqTreeNode[] {
  return [...nodes].sort((a, b) => {
    if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
    return a.name.localeCompare(b.name, "uk");
  });
}

export type WorkshopKanbanClientProps = {
  /** Маршрут `/crm/production/workshop/{slug}` — пріоритетніший за `?stage=` */
  initialStageKey?: WorkshopKanbanStageKey | null;
};

export function WorkshopKanbanClient({ initialStageKey = null }: WorkshopKanbanClientProps = {}) {
  const searchParams = useSearchParams();
  const focusedStage = (
    initialStageKey ?? (parseWorkshopStageParam(searchParams.get("stage")) as WorkshopStageKey | null)
  );
  const [columns, setColumns] = useState<KanbanColumn[]>([]);
  const [dragTaskId, setDragTaskId] = useState<string | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [canMarkMaterialsProgress, setCanMarkMaterialsProgress] = useState(false);
  const [assignees, setAssignees] = useState<AssigneeOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingTaskId, setSavingTaskId] = useState<string | null>(null);
  const [newLineByTask, setNewLineByTask] = useState<Record<string, string>>({});
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [pollMs, setPollMs] = useState(0);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [projectTreeNodes, setProjectTreeNodes] = useState<MiniHqTreeNode[]>([]);
  const [treeLoading, setTreeLoading] = useState(false);
  const [treeSaving, setTreeSaving] = useState(false);
  const [pauseTaskId, setPauseTaskId] = useState<string | null>(null);
  const [pauseReasonCode, setPauseReasonCode] = useState<MiniHqPauseReasonCode>("MATERIAL_WAIT");
  const [pauseComment, setPauseComment] = useState("");
  const [manualProgress, setManualProgress] = useState<Record<string, string>>({});
  const [gitlabProjectByTask, setGitlabProjectByTask] = useState<Record<string, string>>({});
  const [gitlabRefByTask, setGitlabRefByTask] = useState<Record<string, string>>({});
  const [gitlabPathByTask, setGitlabPathByTask] = useState<Record<string, string>>({});
  const [syncingTaskId, setSyncingTaskId] = useState<string | null>(null);

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = Boolean(opts?.silent);
    if (!silent) setLoading(true);
    try {
      const response = await fetch("/api/crm/production/workshop", { cache: "no-store" });
      const payload = await tryReadResponseJson<{
        workshopKanban?: KanbanColumn[];
        canManageWorkshop?: boolean;
        canMarkWorkshopMaterialsProgress?: boolean;
        error?: string;
      }>(response);
      if (!response.ok || !payload) {
        setColumns([]);
        setCanManage(false);
        setCanMarkMaterialsProgress(false);
        return;
      }
      setColumns(payload.workshopKanban ?? []);
      setCanManage(Boolean(payload.canManageWorkshop));
      setCanMarkMaterialsProgress(Boolean(payload.canMarkWorkshopMaterialsProgress));
      setLastSyncedAt(new Date().toISOString());
    } catch {
      setColumns([]);
      setCanManage(false);
      setCanMarkMaterialsProgress(false);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (pollMs <= 0) return;
    const id = window.setInterval(() => {
      void load({ silent: true });
    }, pollMs);
    return () => window.clearInterval(id);
  }, [pollMs, load]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") void load({ silent: true });
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [load]);

  useEffect(() => {
    void (async () => {
      try {
        const r = await fetch("/api/crm/production/workshop/assignees", { cache: "no-store" });
        const j = await tryReadResponseJson<{ users?: AssigneeOption[] }>(r);
        if (r.ok && j) setAssignees(j.users ?? []);
      } catch {
        /* ignore */
      }
    })();
  }, []);

  const allTasks = useMemo(() => columns.flatMap((col) => col.tasks), [columns]);
  const projectOptions = useMemo(() => {
    const byId = new Map<string, { id: string; label: string }>();
    for (const task of allTasks) {
      if (!byId.has(task.flowId)) {
        byId.set(task.flowId, {
          id: task.flowId,
          label: `${task.flowNumber} · ${task.title}`,
        });
      }
    }
    return Array.from(byId.values());
  }, [allTasks]);

  const selectedTask = useMemo(
    () => allTasks.find((task) => task.id === selectedTaskId) ?? null,
    [allTasks, selectedTaskId],
  );

  useEffect(() => {
    if (!selectedTaskId && allTasks.length > 0) {
      setSelectedTaskId(allTasks[0].id);
    }
    if (selectedTaskId && !allTasks.some((task) => task.id === selectedTaskId)) {
      setSelectedTaskId(allTasks[0]?.id ?? null);
    }
  }, [allTasks, selectedTaskId]);

  useEffect(() => {
    if (selectedTask?.flowId) {
      setSelectedProjectId((prev) => prev ?? selectedTask.flowId);
    }
  }, [selectedTask?.flowId]);

  async function loadProjectTree(projectId: string) {
    setTreeLoading(true);
    try {
      const r = await fetch(`/api/crm/production/workshop/projects/${projectId}/tree`, { cache: "no-store" });
      const j = await tryReadResponseJson<{ nodes?: MiniHqTreeNode[] }>(r);
      if (!r.ok || !j) {
        setProjectTreeNodes([]);
        return;
      }
      setProjectTreeNodes(j.nodes ?? []);
    } finally {
      setTreeLoading(false);
    }
  }

  useEffect(() => {
    if (!selectedProjectId) {
      setProjectTreeNodes([]);
      return;
    }
    void loadProjectTree(selectedProjectId);
  }, [selectedProjectId]);

  async function saveProjectTree(nodes: MiniHqTreeNode[]) {
    if (!selectedProjectId || !canManage) return;
    setTreeSaving(true);
    try {
      await postJson(`/api/crm/production/workshop/projects/${selectedProjectId}/tree`, {
        nodes,
      });
      setProjectTreeNodes(nodes);
    } finally {
      setTreeSaving(false);
    }
  }

  function addTreeNode(type: "folder" | "file") {
    if (!canManage) return;
    const name = window.prompt(type === "folder" ? "Назва папки" : "Назва файла");
    if (!name?.trim()) return;
    const node: MiniHqTreeNode = {
      id: globalThis.crypto?.randomUUID?.() ?? `n-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      parentId: null,
      type,
      name: name.trim(),
      stageKey: null,
      gitlabProjectId: null,
      gitlabRef: null,
      gitlabPath: null,
      gitlabWebUrl: null,
    };
    void saveProjectTree([...projectTreeNodes, node]);
  }

  function removeTreeNode(nodeId: string) {
    if (!canManage) return;
    const filtered = projectTreeNodes.filter((node) => node.id !== nodeId && node.parentId !== nodeId);
    void saveProjectTree(filtered);
  }

  async function lifecycleAction(
    task: WorkshopTask,
    action: "start" | "resume" | "complete",
  ) {
    setSavingTaskId(task.id);
    try {
      await postJson(`/api/crm/production/workshop/tasks/${task.id}/${action}`, {});
      await load();
    } finally {
      setSavingTaskId(null);
    }
  }

  async function pauseTask(task: WorkshopTask) {
    setSavingTaskId(task.id);
    try {
      await postJson(`/api/crm/production/workshop/tasks/${task.id}/pause`, {
        reasonCode: pauseReasonCode,
        comment: pauseComment.trim() || null,
      });
      setPauseTaskId(null);
      setPauseComment("");
      await load();
    } finally {
      setSavingTaskId(null);
    }
  }

  async function saveManualProgress(task: WorkshopTask) {
    const raw = manualProgress[task.id] ?? String(task.miniHqProgress.percent ?? 0);
    const value = Number(raw);
    if (!Number.isFinite(value)) return;
    setSavingTaskId(task.id);
    try {
      await patchJson(`/api/crm/production/workshop/tasks/${task.id}/progress`, { percent: value });
      await load();
    } finally {
      setSavingTaskId(null);
    }
  }

  async function syncGitlabProgress(task: WorkshopTask) {
    const gitlabProjectId = (gitlabProjectByTask[task.id] ?? task.miniHqGitLab.projectId ?? "").trim();
    const gitlabRef = (gitlabRefByTask[task.id] ?? task.miniHqGitLab.ref ?? "main").trim() || "main";
    const gitlabPath = (gitlabPathByTask[task.id] ?? task.miniHqGitLab.path ?? "").trim();
    if (!gitlabProjectId || !gitlabPath) return;
    setSyncingTaskId(task.id);
    try {
      await postJson(`/api/crm/production/workshop/tasks/${task.id}/progress`, {
        gitlabProjectId,
        gitlabRef,
        gitlabPath,
      });
      await load();
    } finally {
      setSyncingTaskId(null);
    }
  }

  useEffect(() => {
    if (!selectedTask) return;
    setManualProgress((prev) => ({
      ...prev,
      [selectedTask.id]: prev[selectedTask.id] ?? String(selectedTask.miniHqProgress.percent ?? 0),
    }));
    setGitlabProjectByTask((prev) => ({
      ...prev,
      [selectedTask.id]: prev[selectedTask.id] ?? (selectedTask.miniHqGitLab.projectId ?? ""),
    }));
    setGitlabRefByTask((prev) => ({
      ...prev,
      [selectedTask.id]: prev[selectedTask.id] ?? (selectedTask.miniHqGitLab.ref ?? "main"),
    }));
    setGitlabPathByTask((prev) => ({
      ...prev,
      [selectedTask.id]: prev[selectedTask.id] ?? (selectedTask.miniHqGitLab.path ?? ""),
    }));
  }, [selectedTask]);

  async function move(taskId: string, stageKey: KanbanColumn["stageKey"]) {
    if (!canManage) return;
    await postJson<{ ok?: boolean }>(
      `/api/crm/production/workshop/tasks/${taskId}/move`,
      { stageKey },
    );
    await load();
  }

  async function setAssignee(task: WorkshopTask, assigneeUserId: string | null) {
    setSavingTaskId(task.id);
    try {
      await patchJson(`/api/crm/production/workshop/tasks/${task.id}/assign`, {
        assigneeUserId,
      });
      await load();
    } catch {
      return;
    } finally {
      setSavingTaskId(null);
    }
  }

  async function saveMaterials(task: WorkshopTask, items: WorkshopTask["materialsChecklist"]) {
    setSavingTaskId(task.id);
    try {
      await patchJson(`/api/crm/production/workshop/tasks/${task.id}/materials`, {
        items,
      });
      await load();
    } catch {
      return;
    } finally {
      setSavingTaskId(null);
    }
  }

  function toggleMaterial(task: WorkshopTask, itemId: string) {
    const items = task.materialsChecklist.map((row) =>
      row.id === itemId ? { ...row, done: !row.done } : row,
    );
    void saveMaterials(task, items);
  }

  function seedTemplate(column: KanbanColumn, task: WorkshopTask) {
    const items = buildDefaultMaterialsChecklist(column.stageKey);
    void saveMaterials(task, items);
  }

  function addCustomLine(task: WorkshopTask, column: KanbanColumn, draft: string) {
    const label = draft.trim();
    if (!label) return;
    const scope = defaultScopeForWorkshopStage(column.stageKey);
    const row: WorkshopMaterialCheckItem = { id: newMaterialId(), label, done: false, ...(scope ? { scope } : {}) };
    const items = [...task.materialsChecklist, row];
    void saveMaterials(task, items);
    setNewLineByTask((prev) => ({ ...prev, [task.id]: "" }));
  }

  function removeLine(task: WorkshopTask, itemId: string) {
    const items = task.materialsChecklist.filter((r) => r.id !== itemId);
    void saveMaterials(task, items);
  }

  const reduceMotion = useReducedMotion();

  const doneRatioForColumn = (task: WorkshopTask, column: KanbanColumn) => {
    const m = filterMaterialsForWorkshopStage(
      column.stageKey,
      task.materialsChecklist as WorkshopMaterialCheckItem[],
    );
    if (m.length === 0) return null;
    const done = m.filter((x) => x.done).length;
    return { done, total: m.length };
  };

  const canToggleMaterialCheck = canManage || canMarkMaterialsProgress;

  const visibleColumns = focusedStage
    ? columns.filter((column) => column.stageKey === focusedStage)
    : columns;

  const displayColumns = useMemo(() => {
    const t = Date.now();
    return visibleColumns.map((col) => ({
      ...col,
      tasks: sortWorkshopTasks(col.tasks, t),
    }));
  }, [visibleColumns]);

  function openDetachedStageWindow(stageKey: WorkshopStageKey) {
    if (typeof window === "undefined") return;
    const url = `${window.location.origin}${workshopStageHref(stageKey as WorkshopKanbanStageKey)}`;
    window.open(url, `_blank_${stageKey}`, "noopener,noreferrer,width=1560,height=920");
  }

  return (
    <div className="space-y-5">
      <div className="enver-panel enver-panel--interactive flex flex-wrap items-start justify-between gap-4 p-4 md:p-5">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--enver-muted)]">
            Виробництво · цех
          </p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight text-[var(--enver-text)] md:text-2xl">
            {focusedStage
              ? `Kanban · ${WORKSHOP_STAGE_LABEL_UK[focusedStage as WorkshopKanbanStageKey]}`
              : "Kanban цеху"}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--enver-text-muted)]">
            {focusedStage
              ? "Окреме вікно стадії: переміщуйте картки в рамках потоку та ведіть чекліст матеріалів без зайвих відволікань."
              : "Збірник на задачу та чекліст матеріалів синхронізуються для штабу та бригад. Перетягуйте картки між колонками."}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex flex-wrap items-center justify-end gap-2 text-[11px] text-[var(--enver-text-muted)]">
            <label className="flex items-center gap-1.5">
              <span className="text-[var(--enver-muted)]">Автооновлення</span>
              <select
                value={pollMs}
                onChange={(e) => setPollMs(Number(e.target.value))}
                className="rounded-lg border border-[var(--enver-border)] bg-[var(--enver-input-bg)] px-2 py-1 text-[11px] text-[var(--enver-text)] outline-none transition focus:border-[var(--enver-accent)] focus:ring-2 focus:ring-[var(--enver-accent-ring)]"
              >
                <option value={0}>Вимкнено</option>
                <option value={30_000}>30 с</option>
                <option value={60_000}>60 с</option>
              </select>
            </label>
            <button
              type="button"
              onClick={() => void load({ silent: columns.length > 0 })}
              className="rounded-lg border border-[var(--enver-border)] bg-[var(--enver-card)] px-2.5 py-1 font-medium text-[var(--enver-text)] shadow-[var(--enver-shadow)] transition hover:border-[var(--enver-border-strong)] hover:bg-[var(--enver-hover)]"
            >
              Оновити
            </button>
            {lastSyncedAt ? (
              <span className="font-mono text-[10px] text-[var(--enver-muted)]" title={lastSyncedAt}>
                {lastSyncedAt.replace("T", " ").slice(0, 19)}
              </span>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
          {WORKSHOP_MINI_HQ_STAGE_KEYS.map((stageKey) => (
            <Tooltip key={stageKey}>
              <TooltipTrigger asChild>
                <motion.button
                  type="button"
                  onClick={() => openDetachedStageWindow(stageKey)}
                  className="rounded-lg border border-[var(--enver-border)] bg-[var(--enver-card)] px-2.5 py-1.5 text-[11px] font-medium text-[var(--enver-text)] shadow-[var(--enver-shadow)] transition hover:border-[var(--enver-accent)]/40 hover:bg-[var(--enver-accent-soft)]"
                  whileHover={reduceMotion ? undefined : { y: -1 }}
                  whileTap={reduceMotion ? undefined : { scale: 0.98 }}
                >
                  {WORKSHOP_STAGE_LABEL_UK[stageKey]}
                </motion.button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-[16rem]">
                Відкрити окреме вікно лише для стадії «{WORKSHOP_STAGE_LABEL_UK[stageKey]}»
              </TooltipContent>
            </Tooltip>
          ))}
          {focusedStage ? (
            <Link
              href="/crm/production/workshop"
              className="text-[11px] font-medium text-[var(--enver-text-muted)] underline-offset-2 hover:text-[var(--enver-accent)] hover:underline"
            >
              Показати всі стадії
            </Link>
          ) : null}
          <Link
            href="/crm/production"
            className="text-sm font-medium text-[var(--enver-accent)] underline-offset-2 hover:text-[var(--enver-accent-hover)] hover:underline"
          >
            Штаб виробництва
          </Link>
          </div>
        </div>
      </div>

      {focusedStage ? (
        <section className="rounded-2xl border border-[var(--enver-border)] bg-gradient-to-br from-[var(--enver-accent-soft)] to-[var(--enver-card)] p-4 shadow-[var(--enver-shadow)]">
          <h2 className="text-sm font-semibold text-[var(--enver-text)]">{MINI_HQ_STANDARDS[focusedStage].headline}</h2>
          <p className="mt-1 text-xs leading-relaxed text-[var(--enver-text-muted)]">{MINI_HQ_STANDARDS[focusedStage].intro}</p>
          <ul className="mt-2 list-disc space-y-1 pl-4 text-[11px] leading-snug text-[var(--enver-text-muted)]">
            {MINI_HQ_STANDARDS[focusedStage].bullets.map((b, i) => (
              <li key={`${focusedStage}-${i}`}>{b}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {loading && columns.length === 0 ? (
        <KanbanBoardSkeleton columns={focusedStage ? 1 : 6} />
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[320px,minmax(0,1fr),360px]">
        <aside className="enver-panel enver-panel--interactive min-h-[320px] p-3">
          <div className="mb-3 border-b border-[var(--enver-border)] pb-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--enver-muted)]">
              Проєкт / дерево
            </p>
            <label className="mt-2 block text-[11px] text-[var(--enver-text-muted)]">
              Проєкт
              <select
                value={selectedProjectId ?? ""}
                onChange={(e) => setSelectedProjectId(e.target.value || null)}
                className="mt-1 w-full rounded-lg border border-[var(--enver-border)] bg-[var(--enver-input-bg)] px-2 py-1.5 text-[12px] text-[var(--enver-text)] outline-none focus:border-[var(--enver-accent)] focus:ring-2 focus:ring-[var(--enver-accent-ring)]"
              >
                <option value="">Оберіть проєкт</option>
                {projectOptions.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.label}
                  </option>
                ))}
              </select>
            </label>
            {canManage ? (
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => addTreeNode("folder")}
                  className="rounded-lg border border-[var(--enver-border)] px-2 py-1 text-[11px] hover:bg-[var(--enver-hover)]"
                >
                  + Папка
                </button>
                <button
                  type="button"
                  onClick={() => addTreeNode("file")}
                  className="rounded-lg border border-[var(--enver-border)] px-2 py-1 text-[11px] hover:bg-[var(--enver-hover)]"
                >
                  + Файл
                </button>
              </div>
            ) : null}
          </div>
          <div className="max-h-[560px] space-y-1 overflow-y-auto">
            {treeLoading ? <p className="text-[11px] text-[var(--enver-muted)]">Завантаження дерева…</p> : null}
            {!treeLoading && projectTreeNodes.length === 0 ? (
              <p className="text-[11px] text-[var(--enver-muted)]">Немає вузлів у дереві.</p>
            ) : null}
            {sortedTree(projectTreeNodes).map((node) => (
              <div
                key={node.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-[var(--enver-border)] bg-[var(--enver-surface)] px-2 py-1.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-[11px] text-[var(--enver-text)]">
                      {node.type === "folder" ? "[ПАПКА]" : "[ФАЙЛ]"} {node.name}
                  </p>
                  {node.gitlabPath ? (
                    <p className="truncate text-[10px] text-[var(--enver-muted)]">
                      {node.gitlabProjectId ?? "gitlab"}:{node.gitlabPath}
                    </p>
                  ) : null}
                </div>
                {canManage ? (
                  <button
                    type="button"
                    onClick={() => removeTreeNode(node.id)}
                    className="text-[10px] text-rose-600 hover:underline"
                    disabled={treeSaving}
                  >
                    Видалити
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        </aside>

        <div className={`grid gap-3 ${focusedStage ? "xl:grid-cols-1" : "xl:grid-cols-6"}`}>
          {displayColumns.map((column, colIndex) => (
            <motion.div
              key={column.stageKey}
              className="enver-panel enver-panel--interactive flex min-h-[320px] flex-col p-3"
              initial={reduceMotion ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                delay: reduceMotion ? 0 : colIndex * 0.04,
                duration: 0.28,
                ease: [0.4, 0, 0.2, 1],
              }}
              onDragOver={(event) => {
                if (canManage) {
                  event.preventDefault();
                }
              }}
              onDrop={(event) => {
                if (!canManage) return;
                event.preventDefault();
                if (dragTaskId) {
                  void move(dragTaskId, column.stageKey);
                  setDragTaskId(null);
                }
              }}
            >
              <div className="mb-2 flex items-center justify-between gap-2 border-b border-[var(--enver-border)] pb-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--enver-text)]">
                  {column.stageLabel}
                </p>
                <span className="rounded-full bg-[var(--enver-hover)] px-2 py-0.5 text-[10px] font-medium tabular-nums text-[var(--enver-text-muted)]">
                  {column.tasks.length}
                </span>
              </div>
              <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
                {column.tasks.length === 0 ? (
                  <KanbanEmptyColumn message="Перетягніть картку сюди або дочекайтесь нових задач" />
                ) : null}
                {column.tasks.map((task) => {
                  const displayedMaterials = filterMaterialsForWorkshopStage(
                    column.stageKey,
                    task.materialsChecklist as WorkshopMaterialCheckItem[],
                  );
                  const ratio = doneRatioForColumn(task, column);
                  const busy = savingTaskId === task.id;
                  const due = dueLine(task.dueDate, Date.now());
                  const cardTone =
                    due.overdue
                      ? "border-rose-300/90 bg-[var(--enver-danger-soft)] hover:border-rose-400"
                      : due.soon
                        ? "border-amber-200/90 bg-[var(--enver-warning-soft)] hover:border-amber-300"
                        : "border-[var(--enver-border)] bg-[var(--enver-card)] hover:border-[var(--enver-accent)]/40";
                  return (
                    <motion.article
                      key={task.id}
                      draggable={canManage}
                      onClick={() => setSelectedTaskId(task.id)}
                      onDragStart={() => {
                        if (!canManage) return;
                        setDragTaskId(task.id);
                      }}
                      className={`${canManage ? "cursor-move" : "cursor-default"} rounded-xl border p-2.5 text-xs shadow-[var(--enver-shadow)] transition-[box-shadow,border-color] duration-200 hover:shadow-md ${selectedTaskId === task.id ? "ring-2 ring-[var(--enver-accent-ring)]" : ""} ${cardTone}`}
                      whileDrag={{ scale: 1.02, boxShadow: "0 12px 28px rgba(15, 23, 42, 0.12)" }}
                      whileHover={reduceMotion ? undefined : { y: -1 }}
                    >
                      <div className="flex items-start justify-between gap-1">
                        <div>
                          <p className="font-semibold text-[var(--enver-text)]">{task.flowNumber}</p>
                          <p className="mt-0.5 text-[var(--enver-text-muted)]">{task.title}</p>
                          {task.dueDate ? (
                            <p
                              className={`mt-1 text-[10px] font-medium ${
                                due.overdue ? "text-rose-800" : due.soon ? "text-amber-900" : "text-slate-500"
                              }`}
                            >
                              {due.text}
                            </p>
                          ) : null}
                          <p className="mt-1 text-[10px] text-[var(--enver-muted)]">
                            Стан: {task.miniHqLifecycle.state} · Прогрес: {task.miniHqProgress.percent}%
                          </p>
                        </div>
                        <span className="shrink-0 rounded bg-[var(--enver-hover)] px-1.5 py-0.5 text-[10px] text-[var(--enver-text-muted)]">
                          {task.priority}
                        </span>
                      </div>

                      {column.stageKey === "ASSEMBLY" ? (
                        <div className="mt-2 border-t border-[var(--enver-border)] pt-2">
                          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--enver-muted)]">
                            Збірник (начальник цеху)
                          </p>
                          {canManage ? (
                            <>
                              <select
                                disabled={busy}
                                value={task.assigneeUserId ?? ""}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  void setAssignee(task, v === "" ? null : v);
                                }}
                                className="w-full rounded-lg border border-[var(--enver-border)] bg-[var(--enver-input-bg)] px-2 py-1.5 text-[11px] text-[var(--enver-text)] outline-none focus:border-[var(--enver-accent)] focus:ring-2 focus:ring-[var(--enver-accent-ring)] disabled:opacity-60"
                              >
                                <option value="">Не призначено</option>
                                {assignees.map((u) => (
                                  <option key={u.id} value={u.id}>
                                    {displayName(u)}
                                  </option>
                                ))}
                              </select>
                              {task.assigneeName ? (
                                <p className="mt-1 text-[10px] text-slate-500">Зараз: {task.assigneeName}</p>
                              ) : null}
                            </>
                          ) : (
                            <p className="text-[11px] leading-snug text-slate-700">
                              {task.assigneeName
                                ? `Призначено начальником цеху: ${task.assigneeName}`
                                : "Збірника призначає начальник цеху на цій дільниці — поки не призначено."}
                            </p>
                          )}
                        </div>
                      ) : null}

                      <div className="mt-2 border-t border-[var(--enver-border)] pt-2">
                        <div className="mb-1 flex items-center justify-between gap-1">
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--enver-muted)]">
                            {workshopMaterialsPanelTitle(column.stageKey as WorkshopKanbanStageKey)}
                          </p>
                          {ratio ? (
                            <span className="text-[10px] tabular-nums text-[var(--enver-muted)]">
                              {ratio.done}/{ratio.total}
                            </span>
                          ) : null}
                        </div>
                        <ul className="max-h-36 space-y-1 overflow-y-auto">
                          {displayedMaterials.map((row) => (
                            <li
                              key={row.id}
                              className="flex items-start gap-2 rounded-lg border border-[var(--enver-border)] bg-[var(--enver-surface)] px-1.5 py-1"
                            >
                              <label className="flex flex-1 cursor-pointer items-start gap-2">
                                <input
                                  type="checkbox"
                                  checked={row.done}
                                  disabled={!canToggleMaterialCheck || busy}
                                  onChange={() => toggleMaterial(task, row.id)}
                                  className="mt-0.5 rounded border-slate-300"
                                />
                                <span
                                  className={row.done ? "text-[var(--enver-muted)] line-through" : "text-[var(--enver-text-muted)]"}
                                >
                                  {row.label}
                                </span>
                              </label>
                              {canManage ? (
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => removeLine(task, row.id)}
                                  className="shrink-0 text-[10px] text-rose-600 hover:underline disabled:opacity-50"
                                >
                                  ×
                                </button>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                        {canManage ? (
                          <div className="mt-2 space-y-2">
                            {task.materialsChecklist.length === 0 ? (
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => seedTemplate(column, task)}
                                className="w-full rounded-lg border border-dashed border-slate-300 py-1.5 text-[11px] text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                              >
                                Заповнити шаблоном для «{column.stageLabel}»
                              </button>
                            ) : null}
                            <div className="flex gap-1">
                              <input
                                type="text"
                                placeholder="Новий пункт…"
                                value={newLineByTask[task.id] ?? ""}
                                disabled={busy}
                                onChange={(e) =>
                                  setNewLineByTask((prev) => ({ ...prev, [task.id]: e.target.value }))
                                }
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    addCustomLine(task, column, newLineByTask[task.id] ?? "");
                                  }
                                }}
                                className="min-w-0 flex-1 rounded-lg border border-[var(--enver-border)] bg-[var(--enver-input-bg)] px-2 py-1 text-[11px] text-[var(--enver-text)] outline-none focus:border-[var(--enver-accent)] focus:ring-2 focus:ring-[var(--enver-accent-ring)]"
                              />
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => addCustomLine(task, column, newLineByTask[task.id] ?? "")}
                                className="rounded-lg bg-[var(--enver-accent)] px-2 py-1 text-[11px] font-medium text-white hover:bg-[var(--enver-accent-hover)] disabled:opacity-50"
                              >
                                +
                              </button>
                            </div>
                          </div>
                        ) : canMarkMaterialsProgress ? (
                          <p className="mt-2 text-[10px] text-slate-500">
                            Відмічайте виконання пунктів за фактом — змінювати список може лише начальник цеху.
                          </p>
                        ) : (
                          <p className="mt-2 text-[10px] text-slate-400">Немає прав на зміну чекліста.</p>
                        )}
                      </div>

                      <div className="mt-2 flex items-center justify-between border-t border-[var(--enver-border)] pt-2">
                        <Link
                          href={`/crm/production/${task.flowId}`}
                          className="text-[11px] font-medium text-[var(--enver-accent)] hover:text-[var(--enver-accent-hover)] hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          Штаб замовлення
                        </Link>
                        {busy ? <span className="text-[10px] text-slate-400">Збереження…</span> : null}
                      </div>
                    </motion.article>
                  );
                })}
              </div>
            </motion.div>
          ))}
        </div>

        <aside className="enver-panel enver-panel--interactive min-h-[320px] p-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--enver-muted)]">
            Панель оператора
          </p>
          {!selectedTask ? (
            <p className="mt-3 text-[12px] text-[var(--enver-muted)]">Оберіть картку задачі у колонці.</p>
          ) : (
            <div className="mt-3 space-y-3">
              <div>
                <p className="text-[12px] font-semibold text-[var(--enver-text)]">{selectedTask.flowNumber}</p>
                <p className="text-[12px] text-[var(--enver-text-muted)]">{selectedTask.title}</p>
              </div>
              <div className="rounded-lg border border-[var(--enver-border)] bg-[var(--enver-surface)] p-2">
                <p className="text-[11px] text-[var(--enver-text-muted)]">
                  Стан: <span className="font-semibold text-[var(--enver-text)]">{selectedTask.miniHqLifecycle.state}</span>
                </p>
                <p className="text-[11px] text-[var(--enver-text-muted)]">
                  Активний час: {formatSeconds(selectedTask.miniHqLifecycle.activeSeconds)}
                </p>
                {selectedTask.miniHqLifecycle.pauseReasonCode ? (
                  <p className="text-[11px] text-amber-700">
                    Пауза: {selectedTask.miniHqLifecycle.pauseReasonCode}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded-lg border border-[var(--enver-border)] px-2.5 py-1 text-[11px] hover:bg-[var(--enver-hover)]"
                  onClick={() => void lifecycleAction(selectedTask, "start")}
                  disabled={savingTaskId === selectedTask.id}
                >
                  Запустити
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-[var(--enver-border)] px-2.5 py-1 text-[11px] hover:bg-[var(--enver-hover)]"
                  onClick={() => setPauseTaskId(selectedTask.id)}
                  disabled={savingTaskId === selectedTask.id}
                >
                  Пауза
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-[var(--enver-border)] px-2.5 py-1 text-[11px] hover:bg-[var(--enver-hover)]"
                  onClick={() => void lifecycleAction(selectedTask, "resume")}
                  disabled={savingTaskId === selectedTask.id}
                >
                  Відновити
                </button>
                <button
                  type="button"
                  className="rounded-lg bg-[var(--enver-accent)] px-2.5 py-1 text-[11px] font-medium text-white hover:bg-[var(--enver-accent-hover)]"
                  onClick={() => void lifecycleAction(selectedTask, "complete")}
                  disabled={savingTaskId === selectedTask.id}
                >
                  Завершити
                </button>
              </div>
              <div className="rounded-lg border border-[var(--enver-border)] p-2">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-[var(--enver-text-muted)]">Готовність</span>
                  <span className="font-semibold text-[var(--enver-text)]">{selectedTask.miniHqProgress.percent}%</span>
                </div>
                <div className="mt-2 h-2 w-full overflow-hidden rounded bg-[var(--enver-hover)]">
                  <div
                    className="h-full rounded bg-[var(--enver-accent)]"
                    style={{ width: `${selectedTask.miniHqProgress.percent}%` }}
                  />
                </div>
                <p className="mt-1 text-[10px] text-[var(--enver-muted)]">
                  Джерело: {selectedTask.miniHqProgress.source}
                  {selectedTask.miniHqProgress.lastSyncedAt
                    ? ` · ${selectedTask.miniHqProgress.lastSyncedAt.replace("T", " ").slice(0, 19)}`
                    : ""}
                </p>
                {selectedTask.miniHqProgress.lastError ? (
                  <p className="mt-1 text-[10px] text-rose-600">{selectedTask.miniHqProgress.lastError}</p>
                ) : null}
              </div>

              <div className="space-y-1 rounded-lg border border-[var(--enver-border)] p-2">
                <p className="text-[11px] font-semibold text-[var(--enver-text)]">Синхронізація GitLab</p>
                <input
                  value={gitlabProjectByTask[selectedTask.id] ?? ""}
                  onChange={(e) =>
                    setGitlabProjectByTask((prev) => ({ ...prev, [selectedTask.id]: e.target.value }))
                  }
                  placeholder="ID проєкту (напр. group%2Frepo або 123)"
                  className="w-full rounded-lg border border-[var(--enver-border)] bg-[var(--enver-input-bg)] px-2 py-1 text-[11px]"
                />
                <input
                  value={gitlabRefByTask[selectedTask.id] ?? "main"}
                  onChange={(e) =>
                    setGitlabRefByTask((prev) => ({ ...prev, [selectedTask.id]: e.target.value }))
                  }
                  placeholder="Гілка / ref"
                  className="w-full rounded-lg border border-[var(--enver-border)] bg-[var(--enver-input-bg)] px-2 py-1 text-[11px]"
                />
                <input
                  value={gitlabPathByTask[selectedTask.id] ?? ""}
                  onChange={(e) =>
                    setGitlabPathByTask((prev) => ({ ...prev, [selectedTask.id]: e.target.value }))
                  }
                  placeholder="metrics/workshop-progress.json"
                  className="w-full rounded-lg border border-[var(--enver-border)] bg-[var(--enver-input-bg)] px-2 py-1 text-[11px]"
                />
                <button
                  type="button"
                  onClick={() => void syncGitlabProgress(selectedTask)}
                  className="w-full rounded-lg border border-[var(--enver-border)] px-2 py-1 text-[11px] hover:bg-[var(--enver-hover)]"
                  disabled={syncingTaskId === selectedTask.id}
                >
                  {syncingTaskId === selectedTask.id ? "Синхронізація…" : "Синхронізувати з GitLab"}
                </button>
              </div>

              <div className="space-y-1 rounded-lg border border-[var(--enver-border)] p-2">
                <p className="text-[11px] font-semibold text-[var(--enver-text)]">Ручний відсоток</p>
                <div className="flex gap-2">
                  <input
                    value={manualProgress[selectedTask.id] ?? ""}
                    onChange={(e) =>
                      setManualProgress((prev) => ({ ...prev, [selectedTask.id]: e.target.value }))
                    }
                    type="number"
                    min={0}
                    max={100}
                    className="min-w-0 flex-1 rounded-lg border border-[var(--enver-border)] bg-[var(--enver-input-bg)] px-2 py-1 text-[11px]"
                  />
                  <button
                    type="button"
                    onClick={() => void saveManualProgress(selectedTask)}
                    className="rounded-lg border border-[var(--enver-border)] px-2 py-1 text-[11px] hover:bg-[var(--enver-hover)]"
                  >
                    Зберегти
                  </button>
                </div>
              </div>
            </div>
          )}
        </aside>
      </div>

      {pauseTaskId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-xl border border-[var(--enver-border)] bg-[var(--enver-card)] p-4 shadow-xl">
            <p className="text-sm font-semibold text-[var(--enver-text)]">Пауза задачі</p>
            <p className="mt-1 text-xs text-[var(--enver-text-muted)]">
              Оберіть причину паузи та підтвердьте дію.
            </p>
            <select
              className="mt-3 w-full rounded-lg border border-[var(--enver-border)] bg-[var(--enver-input-bg)] px-2 py-1.5 text-[12px]"
              value={pauseReasonCode}
              onChange={(e) => setPauseReasonCode(e.target.value as MiniHqPauseReasonCode)}
            >
              {MINI_HQ_PAUSE_REASONS.map((reason) => (
                <option key={reason.code} value={reason.code}>
                  {reason.label}
                </option>
              ))}
            </select>
            <textarea
              value={pauseComment}
              onChange={(e) => setPauseComment(e.target.value)}
              placeholder="Коментар до паузи (необов'язково)"
              className="mt-2 h-20 w-full rounded-lg border border-[var(--enver-border)] bg-[var(--enver-input-bg)] px-2 py-1.5 text-[12px]"
            />
            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPauseTaskId(null)}
                className="rounded-lg border border-[var(--enver-border)] px-3 py-1.5 text-[12px] hover:bg-[var(--enver-hover)]"
              >
                Скасувати
              </button>
              <button
                type="button"
                onClick={() => {
                  const task = allTasks.find((t) => t.id === pauseTaskId);
                  if (task) void pauseTask(task);
                }}
                className="rounded-lg bg-[var(--enver-accent)] px-3 py-1.5 text-[12px] font-medium text-white hover:bg-[var(--enver-accent-hover)]"
              >
                Поставити на паузу
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
