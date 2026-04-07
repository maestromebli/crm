"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
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

type KanbanColumn = ProductionCommandCenterView["workshopKanban"][number];
type WorkshopTask = KanbanColumn["tasks"][number];
type WorkshopStageKey = KanbanColumn["stageKey"];

type AssigneeOption = { id: string; name: string | null; email: string | null; role: string };

function displayName(u: AssigneeOption): string {
  return u.name?.trim() || u.email?.trim() || u.id;
}

function newMaterialId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `m-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Avoids SyntaxError when the server returns 204 / empty body / HTML error shell. */
async function readJsonBody<T>(response: Response): Promise<T | null> {
  const text = await response.text();
  if (!text.trim()) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
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

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/crm/production/workshop", { cache: "no-store" });
      const payload = await readJsonBody<{
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
    } catch {
      setColumns([]);
      setCanManage(false);
      setCanMarkMaterialsProgress(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void (async () => {
      try {
        const r = await fetch("/api/crm/production/workshop/assignees", { cache: "no-store" });
        const j = await readJsonBody<{ users?: AssigneeOption[] }>(r);
        if (r.ok && j) setAssignees(j.users ?? []);
      } catch {
        /* ignore */
      }
    })();
  }, []);

  async function move(taskId: string, stageKey: KanbanColumn["stageKey"]) {
    await fetch(`/api/crm/production/workshop/tasks/${taskId}/move`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stageKey }),
    });
    await load();
  }

  async function setAssignee(task: WorkshopTask, assigneeUserId: string | null) {
    setSavingTaskId(task.id);
    try {
      const r = await fetch(`/api/crm/production/workshop/tasks/${task.id}/assign`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assigneeUserId }),
      });
      if (!r.ok) return;
      await load();
    } finally {
      setSavingTaskId(null);
    }
  }

  async function saveMaterials(task: WorkshopTask, items: WorkshopTask["materialsChecklist"]) {
    setSavingTaskId(task.id);
    try {
      const r = await fetch(`/api/crm/production/workshop/tasks/${task.id}/materials`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      if (!r.ok) return;
      await load();
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

  function openDetachedStageWindow(stageKey: WorkshopStageKey) {
    if (typeof window === "undefined") return;
    const url = `${window.location.origin}${workshopStageHref(stageKey as WorkshopKanbanStageKey)}`;
    window.open(url, `_blank_${stageKey}`, "noopener,noreferrer,width=1560,height=920");
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">
            {focusedStage
              ? `Kanban цеху · ${WORKSHOP_STAGE_LABEL_UK[focusedStage as WorkshopKanbanStageKey]}`
              : "Kanban цеху"}
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            {focusedStage
              ? "Окреме вікно стадії: переміщуйте картки в рамках потоку та ведіть чекліст матеріалів без зайвих відволікань."
              : "Збірник на задачу та чекліст матеріалів синхронізуються для штабу та бригад. Перетягуйте картки між колонками."}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {WORKSHOP_MINI_HQ_STAGE_KEYS.map((stageKey) => (
            <Tooltip key={stageKey}>
              <TooltipTrigger asChild>
                <motion.button
                  type="button"
                  onClick={() => openDetachedStageWindow(stageKey)}
                  className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-[11px] font-medium text-slate-700 shadow-sm transition-colors hover:border-sky-300 hover:bg-sky-50/80"
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
              className="text-[11px] font-medium text-slate-600 underline-offset-2 hover:underline"
            >
              Показати всі стадії
            </Link>
          ) : null}
          <Link
            href="/crm/production"
            className="text-sm font-medium text-sky-700 underline-offset-2 hover:underline"
          >
            Штаб виробництва
          </Link>
        </div>
      </div>

      {focusedStage ? (
        <section className="rounded-2xl border border-sky-200/80 bg-gradient-to-br from-sky-50/90 to-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">{MINI_HQ_STANDARDS[focusedStage].headline}</h2>
          <p className="mt-1 text-xs leading-relaxed text-slate-600">{MINI_HQ_STANDARDS[focusedStage].intro}</p>
          <ul className="mt-2 list-disc space-y-1 pl-4 text-[11px] leading-snug text-slate-700">
            {MINI_HQ_STANDARDS[focusedStage].bullets.map((b, i) => (
              <li key={`${focusedStage}-${i}`}>{b}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {loading && columns.length === 0 ? (
        <p className="text-sm text-slate-500">Завантаження…</p>
      ) : null}

      <div className={`grid gap-3 ${focusedStage ? "xl:grid-cols-1" : "xl:grid-cols-6"}`}>
        {visibleColumns.map((column, colIndex) => (
          <motion.div
            key={column.stageKey}
            className="flex min-h-[320px] flex-col rounded-2xl border border-slate-200 bg-slate-50/80 p-3 shadow-sm transition-shadow duration-200 hover:shadow-md"
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
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">{column.stageLabel}</p>
              <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-medium text-slate-600">
                {column.tasks.length}
              </span>
            </div>
            <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
              {column.tasks.map((task) => {
                const displayedMaterials = filterMaterialsForWorkshopStage(
                  column.stageKey,
                  task.materialsChecklist as WorkshopMaterialCheckItem[],
                );
                const ratio = doneRatioForColumn(task, column);
                const busy = savingTaskId === task.id;
                return (
                  <motion.article
                    key={task.id}
                    draggable
                    onDragStart={() => setDragTaskId(task.id)}
                    className="cursor-move rounded-xl border border-slate-200 bg-white p-2.5 text-xs shadow-sm transition-[box-shadow,border-color] duration-200 hover:border-sky-200 hover:shadow-md"
                    whileDrag={{ scale: 1.02, boxShadow: "0 12px 28px rgba(15, 23, 42, 0.12)" }}
                    whileHover={reduceMotion ? undefined : { y: -1 }}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <div>
                        <p className="font-semibold text-slate-900">{task.flowNumber}</p>
                        <p className="mt-0.5 text-slate-600">{task.title}</p>
                      </div>
                      <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">
                        {task.priority}
                      </span>
                    </div>

                    {column.stageKey === "ASSEMBLY" ? (
                      <div className="mt-2 border-t border-slate-100 pt-2">
                        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
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
                              className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[11px] text-slate-800 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 disabled:opacity-60"
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

                    <div className="mt-2 border-t border-slate-100 pt-2">
                      <div className="mb-1 flex items-center justify-between gap-1">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                          {workshopMaterialsPanelTitle(column.stageKey as WorkshopKanbanStageKey)}
                        </p>
                        {ratio ? (
                          <span className="text-[10px] tabular-nums text-slate-500">
                            {ratio.done}/{ratio.total}
                          </span>
                        ) : null}
                      </div>
                      <ul className="max-h-36 space-y-1 overflow-y-auto">
                        {displayedMaterials.map((row) => (
                          <li
                            key={row.id}
                            className="flex items-start gap-2 rounded-lg border border-slate-100 bg-slate-50/90 px-1.5 py-1"
                          >
                            <label className="flex flex-1 cursor-pointer items-start gap-2">
                              <input
                                type="checkbox"
                                checked={row.done}
                                disabled={!canToggleMaterialCheck || busy}
                                onChange={() => toggleMaterial(task, row.id)}
                                className="mt-0.5 rounded border-slate-300"
                              />
                              <span className={row.done ? "text-slate-400 line-through" : "text-slate-700"}>{row.label}</span>
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
                              className="min-w-0 flex-1 rounded-lg border border-slate-200 px-2 py-1 text-[11px] outline-none focus:border-sky-400"
                            />
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => addCustomLine(task, column, newLineByTask[task.id] ?? "")}
                              className="rounded-lg bg-slate-900 px-2 py-1 text-[11px] font-medium text-white hover:bg-slate-800 disabled:opacity-50"
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

                    <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2">
                      <Link
                        href={`/crm/production/${task.flowId}`}
                        className="text-[11px] font-medium text-sky-700 hover:underline"
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
