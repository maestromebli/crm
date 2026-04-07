"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import type { LeadDetailRow } from "../../../../features/leads/queries";
import { useAIStageCheck } from "../../../../features/leads/lead-workflow-ai-hooks";
import { cn } from "../../../../lib/utils";

type Props = {
  lead: LeadDetailRow;
  className?: string;
};

export function LeadWorkspaceChecklist({ lead, className }: Props) {
  const reduceMotion = useReducedMotion();
  const { readiness } = useAIStageCheck(lead);
  const [open, setOpen] = useState(true);

  const total = readiness.items.length;
  const done = readiness.items.filter((i) => i.state === "ready").length;
  const pct = total === 0 ? 100 : Math.round((done / total) * 100);

  return (
    <section
      className={cn(
        "border-b border-[var(--enver-border)] bg-[var(--enver-surface)]",
        className,
      )}
      aria-label="Чекліст готовності"
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left"
      >
        <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--enver-muted)]">
          Чекліст
        </span>
        <span className="flex items-center gap-2 text-[11px] text-[var(--enver-text)]">
          <span className="tabular-nums">{pct}%</span>
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 shrink-0 transition-transform",
              open && "rotate-180",
            )}
            aria-hidden
          />
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            initial={reduceMotion ? false : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={reduceMotion ? undefined : { height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden"
          >
            <div className="space-y-1.5 px-3 pb-3">
              <p className="text-[11px] leading-snug text-[var(--enver-text-muted)]">
                {readiness.headlineUa}
              </p>
              <ul className="space-y-1">
                {readiness.items.map((it) => (
                  <li
                    key={it.key}
                    className="flex items-start gap-2 rounded-[8px] bg-[var(--enver-card)] px-2 py-1.5 text-[11px]"
                  >
                    <span
                      className={cn(
                        "mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full",
                        it.state === "ready" && "bg-emerald-500",
                        it.state === "partial" && "bg-amber-400",
                        it.state === "missing" && "bg-rose-400",
                      )}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1">
                      <span className="font-medium text-[var(--enver-text)]">
                        {it.labelUa}
                      </span>
                      {it.hintUa ? (
                        <span className="mt-0.5 block text-[var(--enver-muted)]">
                          {it.hintUa}
                        </span>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </section>
  );
}
