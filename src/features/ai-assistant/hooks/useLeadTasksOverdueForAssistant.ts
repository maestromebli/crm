"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ENVER_LEAD_TASKS_UPDATED_EVENT,
  type EnverLeadTasksUpdatedDetail,
} from "../constants/leadTasksSync";

type TaskItem = {
  status: string;
  dueAt: string | null;
};

function countOverdueOpen(items: TaskItem[]): number {
  const now = Date.now();
  return items.filter((t) => {
    if (t.status === "DONE" || t.status === "CANCELLED") return false;
    if (!t.dueAt) return false;
    return new Date(t.dueAt).getTime() < now;
  }).length;
}

async function fetchOverdueCount(leadId: string): Promise<number> {
  const r = await fetch(
    `/api/tasks?entityType=LEAD&entityId=${encodeURIComponent(leadId)}`,
  );
  if (!r.ok) return 0;
  const j = (await r.json()) as { items?: TaskItem[] };
  return countOverdueOpen(j.items ?? []);
}

/**
 * Лічильник прострочених відкритих задач ліда для AI-помічника (той самий API, що й вкладка «Задачі»).
 * Оновлюється при поверненні на вкладку та після події {@link ENVER_LEAD_TASKS_UPDATED_EVENT}.
 */
export function useLeadTasksOverdueForAssistant(leadId: string): number {
  const [count, setCount] = useState(0);
  const [syncVersion, setSyncVersion] = useState(0);

  const bump = useCallback(() => {
    setSyncVersion((v) => v + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const n = await fetchOverdueCount(leadId);
        if (!cancelled) setCount(n);
      } catch {
        if (!cancelled) setCount(0);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [leadId, syncVersion]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") bump();
    };

    const onTasksUpdated = (ev: Event) => {
      const ce = ev as CustomEvent<EnverLeadTasksUpdatedDetail>;
      if (ce.detail?.leadId === leadId) bump();
    };

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener(
      ENVER_LEAD_TASKS_UPDATED_EVENT,
      onTasksUpdated as EventListener,
    );

    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener(
        ENVER_LEAD_TASKS_UPDATED_EVENT,
        onTasksUpdated as EventListener,
      );
    };
  }, [leadId, bump]);

  return count;
}
