"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { ProductionOrderStatus } from "@prisma/client";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

type KanbanOrder = {
  id: string;
  dealId: string;
  status: ProductionOrderStatus;
  priority: string;
  deadline: string | null;
  atRisk: boolean;
  riskScore: number;
  progressPct: number;
  clientName: string;
  dealTitle: string;
  dealValue: number | null;
  currency: string | null;
  createdAt: string;
};

const COLS: { id: ProductionOrderStatus; title: string; hint: string }[] = [
  {
    id: "QUEUED",
    title: "Черга",
    hint: "Замовлення в очікуванні запуску або планування.",
  },
  {
    id: "IN_PROGRESS",
    title: "У роботі",
    hint: "Активне виконання етапів на виробництві.",
  },
  {
    id: "PAUSED",
    title: "Пауза",
    hint: "Тимчасово зупинено (узгодження, матеріали, клієнт).",
  },
  {
    id: "COMPLETED",
    title: "Завершено",
    hint: "Закриті замовлення: перетягніть сюди лише після 100% етапів.",
  },
];

function riskLabel(score: number, atRisk: boolean): { text: string; className: string } {
  if (atRisk || score >= 60) {
    return { text: "Ризик", className: "bg-rose-100 text-rose-900 ring-1 ring-rose-200" };
  }
  if (score >= 35) {
    return { text: "Увага", className: "bg-amber-100 text-amber-900 ring-1 ring-amber-200" };
  }
  return { text: "Ок", className: "bg-emerald-50 text-emerald-900 ring-1 ring-emerald-200" };
}

export function ProductionKanbanClient() {
  const reduceMotion = useReducedMotion();
  const [orders, setOrders] = useState<KanbanOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/crm/production/orders", { cache: "no-store" });
      const j = (await r.json()) as { orders?: KanbanOrder[]; error?: string };
      if (!r.ok) {
        throw new Error(
          j.error ??
            (r.status === 503
              ? "База даних не оновлена під модуль виробництва. Виконайте prisma db push."
              : "Помилка завантаження"),
        );
      }
      setOrders(j.orders ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Помилка");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function moveOrder(orderId: string, status: ProductionOrderStatus) {
    const r = await fetch(`/api/crm/production/orders/${orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!r.ok) {
      const j = (await r.json()) as { error?: string };
      setError(j.error ?? "Не вдалося перемістити");
      return;
    }
    await load();
  }

  function onDragStart(e: React.DragEvent, id: string) {
    setDragId(id);
    e.dataTransfer.setData("text/plain", id);
    e.dataTransfer.effectAllowed = "move";
  }

  function onDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }

  async function onDrop(e: React.DragEvent, status: ProductionOrderStatus) {
    e.preventDefault();
    const id = dragId ?? e.dataTransfer.getData("text/plain");
    setDragId(null);
    if (!id) return;
    const cur = orders.find((o) => o.id === id);
    if (!cur || cur.status === status) return;
    if (status === "COMPLETED" && cur.progressPct < 100) {
      setError("Завершити можна лише після 100% етапів (закрийте етапи на картці).");
      return;
    }
    await moveOrder(id, status);
  }

  const byStatus = (s: ProductionOrderStatus) =>
    orders.filter((o) => o.status === s);

  return (
    <div className="space-y-4">
      {error ? (
        <p className="rounded-xl border border-[var(--enver-danger)]/30 bg-[var(--enver-danger-soft)] px-3 py-2 text-sm text-[var(--enver-danger)]">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-[var(--enver-text-muted)]">Завантаження…</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {COLS.map((col, colIndex) => (
            <motion.section
              key={col.id}
              className="enver-panel enver-panel--interactive flex min-h-[320px] flex-col bg-[var(--enver-card)] p-3"
              initial={reduceMotion ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                delay: reduceMotion ? 0 : colIndex * 0.04,
                duration: 0.28,
                ease: [0.4, 0, 0.2, 1],
              }}
              onDragOver={onDragOver}
              onDrop={(e) => void onDrop(e, col.id)}
            >
              <Tooltip>
                <TooltipTrigger asChild>
                  <h2 className="mb-2 cursor-default border-b border-[var(--enver-border)] pb-2 text-xs font-semibold uppercase tracking-wide text-[var(--enver-text-muted)]">
                    {col.title}
                    <span className="ml-2 text-[var(--enver-muted)]">({byStatus(col.id).length})</span>
                  </h2>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[18rem]">
                  {col.hint}
                </TooltipContent>
              </Tooltip>
              <div className="flex flex-1 flex-col gap-2">
                {byStatus(col.id).map((o) => {
                  const rk = riskLabel(o.riskScore, o.atRisk);
                  return (
                    <motion.div
                      key={o.id}
                      draggable
                      onDragStart={(e) => onDragStart(e, o.id)}
                      className="cursor-grab rounded-xl border border-[var(--enver-border)] bg-[var(--enver-surface)] p-3 transition-[border-color,box-shadow] duration-200 hover:border-[var(--enver-accent)]/35 hover:shadow-md active:cursor-grabbing"
                      whileDrag={
                        reduceMotion
                          ? undefined
                          : { scale: 1.02, boxShadow: "0 12px 28px rgba(15, 23, 42, 0.12)" }
                      }
                      whileHover={reduceMotion ? undefined : { y: -1 }}
                    >
                      <Link
                        href={`/crm/production/${o.id}`}
                        className="block font-medium text-[var(--enver-text)] underline-offset-2 transition-colors hover:text-[var(--enver-accent)] hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {o.dealTitle}
                      </Link>
                      <p className="mt-1 text-xs text-[var(--enver-text-muted)]">{o.clientName}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
                        <span
                          className={`rounded-full px-2 py-0.5 font-medium ${rk.className}`}
                        >
                          {rk.text} · {o.riskScore}
                        </span>
                        <span className="rounded-full bg-[var(--enver-hover)] px-2 py-0.5 text-[var(--enver-text)]">
                          {o.progressPct}%
                        </span>
                        <span className="text-[var(--enver-muted)]">
                          {o.dealValue != null
                            ? `${o.dealValue.toLocaleString("uk-UA")} ${o.currency ?? ""}`
                            : "—"}
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] text-[var(--enver-muted)]">
                        Дедлайн:{" "}
                        {o.deadline
                          ? new Date(o.deadline).toLocaleDateString("uk-UA")
                          : "—"}
                      </p>
                    </motion.div>
                  );
                })}
                {byStatus(col.id).length === 0 ? (
                  <p className="text-center text-xs text-[var(--enver-muted)]">Порожньо</p>
                ) : null}
              </div>
            </motion.section>
          ))}
        </div>
      )}

      <p className="text-[11px] text-[var(--enver-text-muted)]">
        Перетягніть картку між колонками. Скасовані замовлення приховані з дошки — керуйте ними з
        картки угоди.
      </p>
    </div>
  );
}
