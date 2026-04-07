"use client";

import { HelpCircle, TrendingDown, TrendingUp } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "../../../lib/utils";
import type { KpiEntry } from "../executive-types";

type KpiCardProps = {
  kpi: KpiEntry;
};

export function KpiCard({ kpi }: KpiCardProps) {
  const delta = kpi.delta;
  const up = delta && delta.absolute >= 0;
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-[var(--enver-border)] bg-[var(--enver-card)] p-4 shadow-[var(--enver-shadow)] transition duration-300",
        "hover:border-[var(--enver-border-strong)] hover:shadow-lg",
      )}
      whileHover={
        reduceMotion ? undefined : { y: -2, transition: { duration: 0.2, ease: [0.4, 0, 0.2, 1] } }
      }
    >
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--enver-muted)]">
            {kpi.title}
          </p>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex cursor-help text-[var(--enver-muted)] outline-none">
                <HelpCircle className="h-3.5 w-3.5" aria-hidden />
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[20rem] text-left leading-snug">
              {kpi.hint}
            </TooltipContent>
          </Tooltip>
        </div>
        <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-[var(--enver-text)]">
          {kpi.value}
        </p>
        {delta ? (
          <p
            className={cn(
              "mt-1 inline-flex items-center gap-1 text-xs font-medium tabular-nums",
              up ? "text-emerald-600" : "text-rose-600",
            )}
          >
            {up ? (
              <TrendingUp className="h-3.5 w-3.5" />
            ) : (
              <TrendingDown className="h-3.5 w-3.5" />
            )}
            {delta.percent != null
              ? `${delta.percent > 0 ? "+" : ""}${delta.percent.toFixed(1)}%`
              : `${delta.absolute > 0 ? "+" : ""}${Math.round(delta.absolute).toLocaleString("uk-UA")}`}{" "}
            <span className="font-normal text-[var(--enver-text-muted)]">
              {delta.label}
            </span>
          </p>
        ) : (
          <p className="mt-1 text-xs text-[var(--enver-text-muted)]">
            {kpi.hint}
          </p>
        )}
      </div>
    </motion.div>
  );
}
