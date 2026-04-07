"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "../../lib/utils";
import { patchTaskById } from "../../lib/api/task-api";
import { dispatchDealTasksUpdated } from "../../features/ai-assistant/utils/dispatchDealTasksUpdated";
import { dispatchLeadTasksUpdated } from "../../features/ai-assistant/utils/dispatchLeadTasksUpdated";

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
  "rounded-xl border border-[var(--enver-accent)]/35 bg-[var(--enver-accent)] px-3 py-2 text-sm font-semibold text-white shadow-sm shadow-[var(--enver-accent)]/25 transition hover:brightness-110 disabled:opacity-50";

type Props = {
  pathname: string;
};

export function TasksWorkspace({ pathname }: Props) {
  const reduceMotion = useReducedMotion();
  const [items, setItems] = useState<TaskRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  let mode: "mine" | "overdue" | "today" | "team" | "diia" | "all" = "all";
  if (pathname.includes("/overdue")) mode = "overdue";
  else if (pathname.includes("/today")) mode = "today";
  else if (pathname.includes("/team")) mode = "team";
  else if (pathname.includes("/diia")) mode = "diia";
  else if (pathname.includes("/my") || pathname === "/tasks") mode = "mine";

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const q = new URLSearchParams();
      if (mode === "mine") q.set("mine", "1");
      if (mode === "overdue") q.set("overdue", "1");
      if (mode === "today") {
        q.set("mine", "1");
        const n = new Date();
        const y = n.getFullYear();
        const mo = String(n.getMonth() + 1).padStart(2, "0");
        const da = String(n.getDate()).padStart(2, "0");
        q.set("dueOn", `${y}-${mo}-${da}`);
      }
      if (mode === "diia") q.set("titlePrefix", "[DIIA]");
      const r = await fetch(`/api/tasks?${q.toString()}`);
      const j = (await r.json()) as { items?: TaskRow[]; error?: string };
      if (!r.ok) throw new Error(j.error ?? "Помилка");
      setItems(j.items ?? []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Помилка");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [mode]);

  useEffect(() => {
    void load();
  }, [load]);

  const complete = async (id: string) => {
    const task = items.find((t) => t.id === id);
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

  const title =
    mode === "mine"
      ? "Мої задачі"
      : mode === "overdue"
        ? "Прострочені задачі"
        : mode === "today"
          ? "Задачі на сьогодні"
          : mode === "team"
            ? "Задачі команди"
            : mode === "diia"
              ? "Дія: задачі підпису"
            : "Задачі";

  return (
    <div className="enver-page-shell flex flex-col px-3 py-4 md:px-6 md:py-5">
      <div className="mx-auto w-full max-w-7xl flex-1 space-y-4">
        <motion.header
          className="enver-panel enver-panel--interactive px-4 py-3"
          initial={reduceMotion ? false : { opacity: 0.94, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
        >
          <h1 className="text-lg font-semibold text-[var(--enver-text)]">{title}</h1>
          <p className="mt-1 text-sm text-[var(--enver-text-muted)]">
            Дані з API `/api/tasks`. Швидке завершення — PATCH статусу DONE.
          </p>
          <div className="mt-3 flex flex-wrap gap-2 text-sm">
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  href="/tasks"
                  className={cn("enver-nav-pill", mode === "mine" && "enver-nav-pill--active")}
                >
                  Мої
                </Link>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-[16rem]">
                Задачі, призначені на вас (фільтр mine).
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  href="/tasks/overdue"
                  className={cn("enver-nav-pill", mode === "overdue" && "enver-nav-pill--active")}
                >
                  Прострочені
                </Link>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-[16rem]">
                Задачі з дедлайном у минулому, ще не виконані.
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  href="/tasks/today"
                  className={cn("enver-nav-pill", mode === "today" && "enver-nav-pill--active")}
                >
                  Сьогодні
                </Link>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-[16rem]">
                Ваші задачі з плановою датою на сьогодні.
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  href="/tasks/team"
                  className={cn("enver-nav-pill", mode === "team" && "enver-nav-pill--active")}
                >
                  Команда
                </Link>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-[16rem]">
                Задачі команди (загальний список за API).
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  href="/tasks/diia"
                  className={cn("enver-nav-pill", mode === "diia" && "enver-nav-pill--active")}
                >
                  Дія
                </Link>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-[16rem]">
                Задачі з префіксом у назві для Дія / підписи.
              </TooltipContent>
            </Tooltip>
          </div>
        </motion.header>

        {err ? (
          <p className="rounded-xl border border-[var(--enver-danger)]/30 bg-[var(--enver-danger-soft)] px-3 py-2 text-sm text-[var(--enver-danger)]">
            {err}
          </p>
        ) : null}

        {loading ? (
          <p className="text-sm text-[var(--enver-text-muted)]">Завантаження…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-[var(--enver-text-muted)]">Немає задач за цим фільтром.</p>
        ) : (
          <ul className="space-y-2">
            {items.map((t) => (
              <motion.li
                key={t.id}
                className="enver-panel enver-panel--interactive flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-sm"
                layout={false}
                initial={reduceMotion ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                whileHover={reduceMotion ? undefined : { y: -1 }}
              >
                <div>
                  <p className="font-medium text-[var(--enver-text)]">{t.title}</p>
                  <p className="text-xs text-[var(--enver-text-muted)]">
                    {t.taskType} · {t.status}
                    {t.dueAt
                      ? ` · до ${new Date(t.dueAt).toLocaleString("uk-UA")}`
                      : ""}
                    {t.assigneeName ? ` · ${t.assigneeName}` : ""}
                  </p>
                  <p className="text-[11px] text-[var(--enver-muted)]">
                    {t.entityType} / {t.entityId}
                  </p>
                </div>
                {t.status !== "DONE" && t.status !== "CANCELLED" ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        disabled={busyId === t.id}
                        className={btn}
                        onClick={() => void complete(t.id)}
                      >
                        {busyId === t.id ? "…" : "Виконано"}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="left">Позначити задачу виконаною (статус DONE)</TooltipContent>
                  </Tooltip>
                ) : null}
              </motion.li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
