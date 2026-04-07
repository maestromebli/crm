"use client";

import { useCallback, useEffect, useState } from "react";
import type { DealWorkspacePayload } from "../../../features/deal-workspace/types";
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
  "rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50";

export function TasksWorkspaceTab({ data }: { data: DealWorkspacePayload }) {
  const dealId = data.deal.id;
  const { showToast } = useDealWorkspaceToast();
  const [items, setItems] = useState<TaskRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState("");
  const [taskType, setTaskType] = useState("FOLLOW_UP");

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const r = await fetch(
        `/api/tasks?entityType=DEAL&entityId=${encodeURIComponent(dealId)}`,
      );
      const j = (await r.json()) as { items?: TaskRow[]; error?: string };
      if (!r.ok) throw new Error(j.error ?? "Помилка");
      setItems(j.items ?? []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Помилка");
    } finally {
      setLoading(false);
    }
  }, [dealId]);

  useEffect(() => {
    void load();
  }, [load]);

  const create = async () => {
    if (!title.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          entityType: "DEAL",
          entityId: dealId,
          taskType,
        }),
      });
      const j = (await r.json()) as { error?: string };
      if (!r.ok) throw new Error(j.error ?? "Помилка");
      setTitle("");
      await load();
      showToast("Задачу додано");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Помилка");
    } finally {
      setBusy(false);
    }
  };

  const complete = async (id: string) => {
    setBusy(true);
    try {
      const r = await fetch(`/api/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "DONE" }),
      });
      const j = (await r.json()) as { error?: string };
      if (!r.ok) throw new Error(j.error ?? "Помилка");
      await load();
      dispatchDealTasksUpdated({ dealId });
      showToast("Задачу позначено виконаною");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Помилка");
    } finally {
      setBusy(false);
    }
  };

  const wrap =
    "rounded-2xl border border-slate-200 bg-[var(--enver-card)] p-4 text-sm shadow-sm";

  return (
    <div className="space-y-4">
      <div className={wrap}>
        <h2 className="text-base font-semibold text-[var(--enver-text)]">
          Швидка задача
        </h2>
        {err ? (
          <p className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-800">
            {err}
          </p>
        ) : null}
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
          <label className="flex-1 text-xs">
            <span className="text-slate-500">Тип</span>
            <select
              value={taskType}
              onChange={(e) => setTaskType(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5"
            >
              <option value="CALLBACK">Перезвін</option>
              <option value="SEND_QUOTE">Надіслати КП</option>
              <option value="PREPARE_ESTIMATE">Підготувати розрахунок</option>
              <option value="SCHEDULE_MEETING">Зустріч</option>
              <option value="VERIFY_PAYMENT">Перевірити оплату</option>
              <option value="FOLLOW_UP">Follow-up</option>
              <option value="OTHER">Інше</option>
            </select>
          </label>
          <label className="flex-[2] text-xs">
            <span className="text-slate-500">Назва</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5"
              placeholder="Що зробити"
            />
          </label>
          <button
            type="button"
            disabled={busy || !title.trim()}
            className={cn(btn, "shrink-0")}
            onClick={() => void create()}
          >
            Додати
          </button>
        </div>
      </div>

      <div className={wrap}>
        <h2 className="text-base font-semibold text-[var(--enver-text)]">
          Задачі по угоді
        </h2>
        {loading ? (
          <p className="mt-2 text-xs text-slate-500">Завантаження…</p>
        ) : items.length === 0 ? (
          <p className="mt-2 text-xs text-slate-500">Поки немає задач.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {items.map((t) => (
              <li
                key={t.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50/80 px-2 py-1.5 text-xs"
              >
                <span>
                  <span className="font-medium text-[var(--enver-text)]">{t.title}</span>
                  <span className="ml-2 text-slate-500">
                    {t.taskType} · {t.status}
                    {t.dueAt
                      ? ` · ${new Date(t.dueAt).toLocaleDateString("uk-UA")}`
                      : ""}
                  </span>
                </span>
                {t.status !== "DONE" && t.status !== "CANCELLED" ? (
                  <button
                    type="button"
                    disabled={busy}
                    className="rounded border border-slate-300 bg-[var(--enver-card)] px-2 py-0.5 text-[11px] font-medium"
                    onClick={() => void complete(t.id)}
                  >
                    OK
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
