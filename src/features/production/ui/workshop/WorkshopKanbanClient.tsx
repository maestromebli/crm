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
  const [tick, setTick] = useState(0);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [pollMs, setPollMs] = useState(0);

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
      setTick((n) => n + 1);
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
    const id = window.setInterval(() => setTick((n) => n + 1), 60_000);
    return () => window.clearInterval(id);
  }, []);

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

  async function move(taskId: string, stageKey: KanbanColumn["stageKey"]) {
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
  }, [visibleColumns, tick]);

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
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              if (dragTaskId) {
                void move(dragTaskId, column.stageKey);
                setDragTaskId(null);
              }
            }}
          >
            <div className="mb-2 flex items-center justify-between gap-2 border-b border-[var(--enver-border)] pb-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--enver-text)]">{column.stageLabel}</p>
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
                    draggable
                    onDragStart={() => setDragTaskId(task.id)}
                    className={`cursor-move rounded-xl border p-2.5 text-xs shadow-[var(--enver-shadow)] transition-[box-shadow,border-color] duration-200 hover:shadow-md ${cardTone}`}
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
                              <span className={row.done ? "text-[var(--enver-muted)] line-through" : "text-[var(--enver-text-muted)]"}>{row.label}</span>
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
    </div>
  );
}
