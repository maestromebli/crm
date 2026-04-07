"use client";

import { AlertTriangle, Banknote, CircleDollarSign, ListChecks } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import type { DealHubRow } from "./deal-hub-row";

type Props = {
  rows: DealHubRow[];
  /** Підпис для першої картки. */
  countLabel?: string;
};

function formatMoney(n: number, currency: string | null): string {
  const cur = currency?.trim() || "UAH";
  return `${n.toLocaleString("uk-UA", { maximumFractionDigits: 0 })} ${cur}`;
}

export function DealsKpiStrip({
  rows,
  countLabel = "У списку",
}: Props) {
  const reduceMotion = useReducedMotion();
  const total = rows.length;
  let sumValue = 0;
  let hasValue = 0;
  let critical = 0;
  let warning = 0;
  let noNext = 0;

  for (const r of rows) {
    if (r.value != null && r.value > 0) {
      sumValue += r.value;
      hasValue += 1;
    }
    if (r.warningBadge === "critical") critical += 1;
    else if (r.warningBadge === "warning") warning += 1;
    const hasNext =
      Boolean(r.nextStepLabel?.trim()) && Boolean(r.nextActionAt);
    if (!hasNext && r.status === "OPEN") noNext += 1;
  }

  const curSample =
    rows.find((x) => x.value != null && x.value > 0)?.currency ?? null;

  const cards = [
    {
      icon: ListChecks,
      label: countLabel,
      value: String(total),
      sub: total === 1 ? "угода" : "угод",
      tone: "slate" as const,
      hint: "Кількість угод у поточному відфільтрованому списку.",
    },
    {
      icon: CircleDollarSign,
      label: "Сума в рядках",
      value: hasValue > 0 ? formatMoney(sumValue, curSample) : "—",
      sub: hasValue ? `${hasValue} з сумою` : "немає сум",
      tone: "emerald" as const,
      hint: "Сума значень угод, де вказана вартість; валюта з першого рядка з сумою.",
    },
    {
      icon: AlertTriangle,
      label: "Ризики",
      value: critical + warning > 0 ? `${critical + warning}` : "0",
      sub:
        critical > 0
          ? `${critical} критично`
          : warning > 0
            ? `${warning} увага`
            : "без прапорців",
      tone:
        critical > 0
          ? ("rose" as const)
          : warning > 0
            ? ("amber" as const)
            : ("slate" as const),
      hint: "Угоди з прапорцем критичного ризику або попередження за SLA та оплатами.",
    },
    {
      icon: Banknote,
      label: "Без наступного кроку",
      value: String(noNext),
      sub: "лише відкриті",
      tone: noNext > 0 ? ("amber" as const) : ("slate" as const),
      hint: "Відкриті угоди без запланованого наступного кроку та дати.",
    },
  ];

  const kpiBg = [
    "bg-[var(--enver-accent)]",
    "bg-[#4c3d9e]",
    "bg-[var(--enver-warning)]",
    "bg-[var(--enver-success)]",
  ] as const;

  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((c, i) => (
        <Tooltip key={c.label}>
          <TooltipTrigger asChild>
            <motion.div
              className={`flex cursor-default gap-3 rounded-lg px-3 py-3 shadow-[0_2px_8px_rgba(0,0,0,0.12)] ${kpiBg[i % 4]}`}
              whileHover={
                reduceMotion ? undefined : { y: -2, transition: { duration: 0.2 } }
              }
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[var(--enver-card)]/15 text-white">
                <c.icon className="h-5 w-5" strokeWidth={1.75} aria-hidden />
              </div>
              <div className="min-w-0 text-white">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-white/80">
                  {c.label}
                </p>
                <p className="truncate text-xl font-bold tabular-nums tracking-tight">
                  {c.value}
                </p>
                <p className="text-[10px] text-white/75">{c.sub}</p>
              </div>
            </motion.div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-[18rem] text-left leading-snug">
            {c.hint}
          </TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}
