"use client";

import Link from "next/link";
import { format } from "date-fns";
import { uk } from "date-fns/locale";
import { useCallback, useEffect, useState } from "react";
import {
  ENVER_LEAD_TASKS_UPDATED_EVENT,
  type EnverLeadTasksUpdatedDetail,
} from "../../../../features/ai-assistant/constants/leadTasksSync";

type TaskRow = {
  id: string;
  title: string;
  status: string;
  dueAt: string | null;
};

type Props = {
  leadId: string;
  canViewTasks: boolean;
};

export function LeadTasksCard({ leadId, canViewTasks }: Props) {
  const [items, setItems] = useState<TaskRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncVersion, setSyncVersion] = useState(0);
  const bump = useCallback(() => setSyncVersion((v) => v + 1), []);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") bump();
    };
    const onLeadTasks = (ev: Event) => {
      const ce = ev as CustomEvent<EnverLeadTasksUpdatedDetail>;
      if (ce.detail?.leadId === leadId) bump();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener(
      ENVER_LEAD_TASKS_UPDATED_EVENT,
      onLeadTasks as EventListener,
    );
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener(
        ENVER_LEAD_TASKS_UPDATED_EVENT,
        onLeadTasks as EventListener,
      );
    };
  }, [leadId, bump]);

  useEffect(() => {
    if (!canViewTasks) {
      setLoading(false);
      return;
    }
    const ac = new AbortController();
    let c = false;
    void (async () => {
      try {
        const r = await fetch(
          `/api/tasks?entityType=LEAD&entityId=${encodeURIComponent(leadId)}`,
          { signal: ac.signal, cache: "no-store" },
        );
        const j = (await r.json().catch(() => ({}))) as { items?: TaskRow[] };
        if (!c && r.ok) {
          const list = j.items ?? [];
          const open = list.filter((t) => t.status !== "DONE" && t.status !== "CANCELLED");
          setItems(open);
        }
      } catch (error) {
        if ((error as { name?: string } | null)?.name === "AbortError") return;
        if (!c) setItems([]);
      } finally {
        if (!c) setLoading(false);
      }
    })();
    return () => {
      c = true;
      ac.abort();
    };
  }, [leadId, canViewTasks, syncVersion]);

  const now = new Date();
  const overdue = items.filter(
    (t) => t.dueAt && new Date(t.dueAt) < now,
  );
  const rest = items.filter(
    (t) => !t.dueAt || new Date(t.dueAt) >= now,
  );

  if (!canViewTasks) {
    return (
      <section
        id="lead-tasks"
        className="leadhub-card p-4"
      >
        <span className="leadhub-kicker">Tasks</span>
        <h3 className="leadhub-title mt-1">Задачі</h3>
        <p className="leadhub-subtitle">Немає доступу до задач.</p>
      </section>
    );
  }

  return (
    <section
      id="lead-tasks"
      className="leadhub-card p-4"
    >
      <div className="leadhub-head">
        <div>
          <span className="leadhub-kicker">Tasks</span>
          <h3 className="leadhub-title mt-1">Задачі</h3>
          <p className="leadhub-subtitle">Прострочені й найближчі до виконання.</p>
        </div>
        <Link
          href={`/leads/${leadId}/tasks`}
          className="leadhub-inline-link"
        >
          Усі →
        </Link>
      </div>
      {loading ? (
        <p className="mt-2 text-[12px] text-[var(--enver-muted)]">Завантаження…</p>
      ) : overdue.length ? (
        <ul className="mt-2 space-y-1">
          {overdue.map((t) => (
            <li
              key={t.id}
              className="rounded-lg border border-rose-200/80 bg-rose-50/90 px-2 py-1.5 text-[12px] text-rose-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]"
            >
              <span className="font-medium">Прострочено:</span> {t.title}
              {t.dueAt
                ? ` · ${format(new Date(t.dueAt), "d MMM", { locale: uk })}`
                : ""}
            </li>
          ))}
        </ul>
      ) : null}
      {!loading && rest.length ? (
        <ul className="mt-2 space-y-1">
          {rest.slice(0, 3).map((t) => (
            <li key={t.id} className="leadhub-list-item px-2.5 py-2 text-[12px] text-slate-800">
              · {t.title}
              {t.dueAt
                ? ` — ${format(new Date(t.dueAt), "d MMM", { locale: uk })}`
                : ""}
            </li>
          ))}
        </ul>
      ) : null}
      {!loading && !items.length ? (
        <p className="mt-2 text-[12px] text-[var(--enver-muted)]">Openх задач немає.</p>
      ) : null}
    </section>
  );
}
