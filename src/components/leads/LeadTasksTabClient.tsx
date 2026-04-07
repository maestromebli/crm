"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { uk } from "date-fns/locale";
import { cn } from "../../lib/utils";
import { dispatchLeadTasksUpdated } from "../../features/ai-assistant/utils/dispatchLeadTasksUpdated";

type TaskRow = {
  id: string;
  title: string;
  description: string | null;
  taskType: string;
  status: string;
  priority: string;
  dueAt: string | null;
  assigneeName: string | null;
};

const TYPE_UA: Record<string, string> = {
  CALLBACK: "Передзвонити",
  SEND_QUOTE: "Надіслати КП",
  PREPARE_ESTIMATE: "Підготувати кошторис",
  SCHEDULE_MEETING: "Запланувати зустріч",
  VERIFY_PAYMENT: "Перевірити оплату",
  FOLLOW_UP: "Повторний контакт",
  SEND_KP: "Надіслати КП (окремо)",
  COLLECT_FILES: "Зібрати файли",
  CLARIFY_PROJECT: "Уточнити проєкт",
  APPROVAL_FOLLOW_UP: "Контроль погодження",
  OTHER: "Інше",
};

const STATUS_UA: Record<string, string> = {
  OPEN: "Відкрита",
  IN_PROGRESS: "В роботі",
  DONE: "Виконано",
  CANCELLED: "Скасовано",
};

const PRIORITY_UA: Record<string, string> = {
  LOW: "Низька",
  NORMAL: "Звичайна",
  HIGH: "Висока",
  URGENT: "Терміново",
};

type Props = {
  leadId: string;
  canView: boolean;
  canCreate: boolean;
  canUpdate: boolean;
};

export function LeadTasksTabClient({
  leadId,
  canView,
  canCreate,
  canUpdate,
}: Props) {
  const searchParams = useSearchParams();
  const formAnchorRef = useRef<HTMLDivElement>(null);
  const [items, setItems] = useState<TaskRow[]>([]);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [taskType, setTaskType] = useState("FOLLOW_UP");
  const [dueAt, setDueAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [formErr, setFormErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!canView) return;
    try {
      const r = await fetch(
        `/api/tasks?entityType=LEAD&entityId=${encodeURIComponent(leadId)}`,
      );
      const j = (await r.json()) as { items?: TaskRow[]; error?: string };
      if (!r.ok) throw new Error(j.error ?? "Не вдалося завантажити");
      setItems(j.items ?? []);
      setLoadErr(null);
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : "Помилка");
      setItems([]);
    }
  }, [canView, leadId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (searchParams.get("new") !== "1") return;
    setTaskType("CALLBACK");
    requestAnimationFrame(() => {
      formAnchorRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }, [searchParams]);

  const createTask = async () => {
    const t = title.trim();
    if (!t) {
      setFormErr("Вкажіть назву");
      return;
    }
    setFormErr(null);
    setBusy(true);
    try {
      const r = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: t,
          entityType: "LEAD",
          entityId: leadId,
          taskType,
          ...(dueAt ? { dueAt: new Date(dueAt).toISOString() } : {}),
        }),
      });
      const j = (await r.json()) as { error?: string };
      if (!r.ok) throw new Error(j.error ?? "Помилка");
      setTitle("");
      setDueAt("");
      await load();
      dispatchLeadTasksUpdated({ leadId });
    } catch (e) {
      setFormErr(e instanceof Error ? e.message : "Помилка");
    } finally {
      setBusy(false);
    }
  };

  const patchStatus = async (id: string, status: string) => {
    if (!canUpdate) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const j = (await r.json()) as { error?: string };
      if (!r.ok) throw new Error(j.error ?? "Помилка");
      await load();
      dispatchLeadTasksUpdated({ leadId });
    } finally {
      setBusy(false);
    }
  };

  const wrap =
    "rounded-2xl border border-slate-200 bg-[var(--enver-card)] p-4 text-sm shadow-sm";

  if (!canView) {
    return (
      <section className={wrap}>
        <p className="text-xs text-slate-600">
          Немає доступу до задач (потрібне право перегляду задач).
        </p>
      </section>
    );
  }

  return (
    <div className="space-y-4">
      {canCreate ? (
        <section className={wrap} ref={formAnchorRef}>
          <h2 className="text-sm font-semibold text-[var(--enver-text)]">Нова задача</h2>
          {formErr ? (
            <p className="mt-2 text-xs text-rose-700">{formErr}</p>
          ) : null}
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <label className="block text-[11px] sm:col-span-2">
              <span className="text-slate-500">Назва</span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
              />
            </label>
            <label className="block text-[11px]">
              <span className="text-slate-500">Тип</span>
              <select
                value={taskType}
                onChange={(e) => setTaskType(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
              >
                {Object.entries(TYPE_UA).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-[11px]">
              <span className="text-slate-500">Термін (необовʼязково)</span>
              <input
                type="datetime-local"
                value={dueAt}
                onChange={(e) => setDueAt(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
              />
            </label>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() => void createTask()}
            className={cn(
              "mt-3 rounded-lg bg-slate-900 px-4 py-2 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50",
            )}
          >
            {busy ? "Зберігаю…" : "Створити"}
          </button>
        </section>
      ) : null}

      <section className={wrap}>
        <h2 className="text-sm font-semibold text-[var(--enver-text)]">Задачі по ліду</h2>
        {loadErr ? (
          <p className="mt-2 text-xs text-rose-700">{loadErr}</p>
        ) : items.length === 0 ? (
          <p className="mt-2 text-xs text-slate-500">Поки немає задач.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {items.map((t) => (
              <li
                key={t.id}
                className="rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2 text-xs"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-[var(--enver-text)]">{t.title}</p>
                    <p className="text-[10px] text-slate-500">
                      {TYPE_UA[t.taskType] ?? t.taskType} ·{" "}
                      {PRIORITY_UA[t.priority] ?? t.priority}
                      {t.assigneeName ? ` · ${t.assigneeName}` : ""}
                    </p>
                    {t.dueAt ? (
                      <p className="text-[10px] text-slate-500">
                        До{" "}
                        {format(new Date(t.dueAt), "d MMM yyyy, HH:mm", {
                          locale: uk,
                        })}
                      </p>
                    ) : null}
                  </div>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2 py-0.5 text-[10px]",
                      t.status === "DONE"
                        ? "bg-emerald-100 text-emerald-800"
                        : t.status === "CANCELLED"
                          ? "bg-slate-200 text-slate-600"
                          : "bg-amber-100 text-amber-900",
                    )}
                  >
                    {STATUS_UA[t.status] ?? t.status}
                  </span>
                </div>
                {canUpdate && t.status !== "DONE" && t.status !== "CANCELLED" ? (
                  <div className="mt-2 flex flex-wrap gap-1">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void patchStatus(t.id, "IN_PROGRESS")}
                      className="rounded border border-slate-200 bg-[var(--enver-card)] px-2 py-0.5 text-[10px] hover:bg-[var(--enver-hover)] disabled:opacity-50"
                    >
                      В роботі
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void patchStatus(t.id, "DONE")}
                      className="rounded border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] text-emerald-900 hover:bg-emerald-100 disabled:opacity-50"
                    >
                      Виконано
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void patchStatus(t.id, "CANCELLED")}
                      className="rounded border border-slate-200 px-2 py-0.5 text-[10px] text-slate-600 hover:bg-slate-100 disabled:opacity-50"
                    >
                      Скасувати
                    </button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
