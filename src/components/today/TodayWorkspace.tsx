"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { dispatchDealTasksUpdated } from "../../features/ai-assistant/utils/dispatchDealTasksUpdated";
import { dispatchLeadTasksUpdated } from "../../features/ai-assistant/utils/dispatchLeadTasksUpdated";
import { patchTaskById } from "../../lib/api/task-api";
type TaskRow = {
  id: string;
  title: string;
  status: string;
  taskType: string;
  dueAt: string | null;
  entityType: string;
  entityId: string;
  assigneeName: string | null;
};

const btn =
  "rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50";

function todayYmd(): string {
  const n = new Date();
  const y = n.getFullYear();
  const m = String(n.getMonth() + 1).padStart(2, "0");
  const d = String(n.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function entityHref(t: TaskRow): string | null {
  if (t.entityType === "DEAL") return `/deals/${t.entityId}/workspace`;
  if (t.entityType === "LEAD") return `/leads/${t.entityId}`;
  return null;
}

export function TodayWorkspace() {
  const [overdue, setOverdue] = useState<TaskRow[]>([]);
  const [today, setToday] = useState<TaskRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const dueOn = useMemo(() => todayYmd(), []);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const [r1, r2] = await Promise.all([
        fetch(`/api/tasks?mine=1&overdue=1`),
        fetch(`/api/tasks?mine=1&dueOn=${encodeURIComponent(dueOn)}`),
      ]);
      const j1 = (await r1.json()) as { items?: TaskRow[]; error?: string };
      const j2 = (await r2.json()) as { items?: TaskRow[]; error?: string };
      if (!r1.ok) throw new Error(j1.error ?? "Помилка прострочених");
      if (!r2.ok) throw new Error(j2.error ?? "Помилка задач на сьогодні");
      setOverdue(j1.items ?? []);
      setToday(j2.items ?? []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Помилка");
      setOverdue([]);
      setToday([]);
    } finally {
      setLoading(false);
    }
  }, [dueOn]);

  useEffect(() => {
    void load();
  }, [load]);

  const complete = async (id: string) => {
    const task =
      overdue.find((t) => t.id === id) ?? today.find((t) => t.id === id);
    setBusyId(id);
    try {
      await patchTaskById(id, { status: "DONE" });
      await load();
      if (task?.entityType === "LEAD") {
        dispatchLeadTasksUpdated({ leadId: task.entityId });
      }
      if (task?.entityType === "DEAL") {
        dispatchDealTasksUpdated({ dealId: task.entityId });
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Помилка");
    } finally {
      setBusyId(null);
    }
  };

  const renderList = (items: TaskRow[], empty: string) => {
    if (loading) return <p className="text-sm text-slate-500">Завантаження…</p>;
    if (items.length === 0)
      return <p className="text-sm text-slate-500">{empty}</p>;
    return (
      <ul className="space-y-2">
        {items.map((t) => {
          const href = entityHref(t);
          return (
            <li
              key={t.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-[var(--enver-card)] px-3 py-2 text-sm"
            >
              <div className="min-w-0">
                <p className="font-medium text-[var(--enver-text)]">{t.title}</p>
                <p className="text-xs text-slate-500">
                  {t.taskType} ·{" "}
                  {t.dueAt
                    ? new Date(t.dueAt).toLocaleString("uk-UA")
                    : "без дати"}
                </p>
                {href ? (
                  <Link
                    href={href}
                    className="mt-1 inline-block text-[11px] font-medium text-slate-700 underline"
                  >
                    Відкрити в CRM →
                  </Link>
                ) : (
                  <p className="mt-1 text-[11px] text-slate-400">
                    {t.entityType} / {t.entityId}
                  </p>
                )}
              </div>
              {t.status !== "DONE" && t.status !== "CANCELLED" ? (
                <button
                  type="button"
                  disabled={busyId === t.id}
                  className={btn}
                  onClick={() => void complete(t.id)}
                >
                  {busyId === t.id ? "…" : "Готово"}
                </button>
              ) : null}
            </li>
          );
        })}
      </ul>
    );
  };

  return (
    <div className="flex min-h-[calc(100vh-56px)] flex-col bg-slate-50 px-3 py-3 md:px-6 md:py-4">
      <div className="mx-auto w-full max-w-6xl flex-1 space-y-4">
        <header className="rounded-2xl border border-slate-200 bg-[var(--enver-card)]/90 px-4 py-3 shadow-sm">
          <h1 className="text-lg font-semibold text-[var(--enver-text)]">Мій день</h1>
          <p className="mt-1 text-xs text-slate-600">
            Прострочені та задачі з дедлайном сьогодні (ваші). Що зробити зараз
            — зверху вниз.
          </p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <Link
              href="/today"
              className="rounded-full bg-slate-900 px-2 py-1 text-white"
            >
              Мій день
            </Link>
            <Link
              href="/tasks"
              className="rounded-full bg-slate-100 px-2 py-1 text-slate-800 hover:bg-slate-200"
            >
              Усі мої задачі
            </Link>
            <Link
              href="/tasks/overdue"
              className="rounded-full bg-slate-100 px-2 py-1 text-slate-800 hover:bg-slate-200"
            >
              Тільки прострочені
            </Link>
          </div>
        </header>

        {err ? (
          <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">
            {err}
          </p>
        ) : null}

        <section className="rounded-2xl border border-rose-100 bg-rose-50/40 px-4 py-3 shadow-sm">
          <h2 className="text-sm font-semibold text-rose-950">
            Прострочені ({overdue.length})
          </h2>
          <div className="mt-2">
            {renderList(overdue, "Немає прострочених — супер.")}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-[var(--enver-card)] px-4 py-3 shadow-sm">
          <h2 className="text-sm font-semibold text-[var(--enver-text)]">
            Сьогодні ({today.length})
          </h2>
          <div className="mt-2">
            {renderList(
              today,
              "На сьогодні задач немає — перевірте угоди без наступного кроку.",
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
