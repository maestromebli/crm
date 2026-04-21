"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { dealQueryKeys } from "../../../features/deal-workspace/deal-query-keys";
import { patchTaskById } from "../../../features/deal-workspace/use-deal-mutation-actions";
import type { DealWorkspacePayload } from "../../../features/deal-workspace/types";
import { postJson } from "../../../lib/api/patch-json";
import { cn } from "../../../lib/utils";
import { dispatchDealTasksUpdated } from "../../../features/ai-assistant/utils/dispatchDealTasksUpdated";
import { useDealWorkspaceToast } from "../DealWorkspaceToast";

type TaskRow = {
  id: string;
  title: string;
  status: string;
  taskType: string;
  dueAt: string | null;
};

const btn =
  "rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50";

export function TasksWorkspaceTab({ data }: { data: DealWorkspacePayload }) {
  const dealId = data.deal.id;
  const queryClient = useQueryClient();
  const { showToast } = useDealWorkspaceToast();
  const [err, setErr] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [taskType, setTaskType] = useState("FOLLOW_UP");

  const tasksQuery = useQuery({
    queryKey: dealQueryKeys.tasks(dealId),
    queryFn: async (): Promise<TaskRow[]> => {
      const r = await fetch(
        `/api/tasks?entityType=DEAL&entityId=${encodeURIComponent(dealId)}`,
      );
      const j = (await r.json()) as { items?: TaskRow[]; error?: string };
      if (!r.ok) throw new Error(j.error ?? "Помилка");
      return j.items ?? [];
    },
    staleTime: 15_000,
  });
  const queryErr = tasksQuery.error instanceof Error ? tasksQuery.error.message : null;

  const createMutation = useMutation<
    TaskRow,
    Error,
    { title: string; taskType: string },
    { previous?: TaskRow[]; tempId: string }
  >({
    mutationFn: async ({ title: nextTitle, taskType: nextType }) => {
      const j = await postJson<{ task?: TaskRow; error?: string }>("/api/tasks", {
        title: nextTitle,
        entityType: "DEAL",
        entityId: dealId,
        taskType: nextType,
      });
      if (!j.task) throw new Error(j.error ?? "Помилка");
      return j.task;
    },
    onMutate: async ({ title: nextTitle, taskType: nextType }) => {
      setErr(null);
      const tempId = `tmp-${Date.now()}`;
      await queryClient.cancelQueries({ queryKey: dealQueryKeys.tasks(dealId) });
      const previous = queryClient.getQueryData<TaskRow[]>(dealQueryKeys.tasks(dealId));
      const optimistic: TaskRow = {
        id: tempId,
        title: nextTitle,
        taskType: nextType,
        status: "OPEN",
        dueAt: null,
      };
      queryClient.setQueryData<TaskRow[]>(dealQueryKeys.tasks(dealId), (current) => [
        optimistic,
        ...(current ?? []),
      ]);
      return { previous, tempId };
    },
    onError: (e, _vars, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(dealQueryKeys.tasks(dealId), ctx.previous);
      }
      setErr(e.message);
    },
    onSuccess: (created, _vars, ctx) => {
      queryClient.setQueryData<TaskRow[]>(dealQueryKeys.tasks(dealId), (current) =>
        (current ?? []).map((row) => (row.id === ctx.tempId ? created : row)),
      );
      dispatchDealTasksUpdated({ dealId });
      showToast("Задачу додано");
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: dealQueryKeys.tasks(dealId) });
    },
  });

  const completeMutation = useMutation<
    void,
    Error,
    { id: string },
    { previous?: TaskRow[] }
  >({
    mutationFn: async ({ id }) => {
      await patchTaskById(id, { status: "DONE" });
    },
    onMutate: async ({ id }) => {
      setErr(null);
      await queryClient.cancelQueries({ queryKey: dealQueryKeys.tasks(dealId) });
      const previous = queryClient.getQueryData<TaskRow[]>(dealQueryKeys.tasks(dealId));
      queryClient.setQueryData<TaskRow[]>(dealQueryKeys.tasks(dealId), (current) =>
        (current ?? []).map((row) =>
          row.id === id ? { ...row, status: "DONE" } : row,
        ),
      );
      return { previous };
    },
    onError: (e, _vars, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(dealQueryKeys.tasks(dealId), ctx.previous);
      }
      setErr(e.message);
    },
    onSuccess: () => {
      dispatchDealTasksUpdated({ dealId });
      showToast("Задачу позначено виконаною");
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: dealQueryKeys.tasks(dealId) });
    },
  });

  const create = async () => {
    if (!title.trim()) return;
    await createMutation.mutateAsync({ title: title.trim(), taskType });
    setTitle("");
  };

  const complete = async (id: string) => {
    await completeMutation.mutateAsync({ id });
  };

  const wrap =
    "rounded-2xl border border-slate-200 bg-[var(--enver-card)] p-4 text-sm shadow-sm";

  return (
    <div className="space-y-4">
      <div className={wrap}>
        <h2 className="text-base font-semibold text-[var(--enver-text)]">
          Швидка задача
        </h2>
        {err ?? queryErr ? (
          <p className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">
            {err ?? queryErr}
          </p>
        ) : null}
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
          <label className="flex-1 text-sm">
            <span className="text-slate-500">Тип</span>
            <select
              value={taskType}
              onChange={(e) => setTaskType(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm"
            >
              <option value="CALLBACK">Перезвін</option>
              <option value="SEND_QUOTE">Надіслати КП</option>
              <option value="PREPARE_ESTIMATE">Підготувати розрахунок</option>
              <option value="SCHEDULE_MEETING">Зустріч</option>
              <option value="VERIFY_PAYMENT">Перевірити оплату</option>
              <option value="FOLLOW_UP">Повторний контакт</option>
              <option value="OTHER">Інше</option>
            </select>
          </label>
          <label className="flex-[2] text-sm">
            <span className="text-slate-500">Назва</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm"
              placeholder="Що зробити"
            />
          </label>
          <button
            type="button"
            disabled={
              createMutation.isPending || completeMutation.isPending || !title.trim()
            }
            className={cn(btn, "shrink-0")}
            onClick={() => void create()}
          >
            Додати
          </button>
        </div>
      </div>

      <div className={wrap}>
        <h2 className="text-base font-semibold text-[var(--enver-text)]">
          Задачі по замовленню
        </h2>
        {tasksQuery.isPending ? (
          <p className="mt-2 text-sm text-slate-500">Завантаження…</p>
        ) : (tasksQuery.data ?? []).length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">Поки немає задач.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {(tasksQuery.data ?? []).map((t) => (
              <li
                key={t.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2 text-sm"
              >
                <span>
                  <span className="font-medium text-[var(--enver-text)]">{t.title}</span>
                  <span className="ml-2 text-xs text-slate-500">
                    {t.taskType} · {t.status}
                    {t.dueAt
                      ? ` · ${new Date(t.dueAt).toLocaleDateString("uk-UA")}`
                      : ""}
                  </span>
                </span>
                {t.status !== "DONE" && t.status !== "CANCELLED" ? (
                  <button
                    type="button"
                    disabled={createMutation.isPending || completeMutation.isPending}
                    className="rounded border border-slate-300 bg-[var(--enver-card)] px-2.5 py-1 text-xs font-medium"
                    onClick={() => void complete(t.id)}
                  >
                    Готово
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
