"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import type { LeadDetailRow } from "../../../../features/leads/queries";
import {
  getLeadDominantNextStep,
  mapLeadDetailRowToCoreInput,
} from "../../../../lib/crm-core";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "../../../../lib/utils";

type Props = {
  lead: LeadDetailRow;
  /** Права колонка Hub — великий акцентний CTA без градієнтів. */
  placement?: "default" | "rail";
};

/**
 * Один домінантний CTA — «Наступний крок» (CRM Core), стадійна логіка.
 */
export function LeadHubNextStepBanner({ lead, placement = "default" }: Props) {
  const reduceMotion = useReducedMotion();
  const d = getLeadDominantNextStep(mapLeadDetailRowToCoreInput(lead));
  const href =
    d.route && !d.disabled
      ? `${d.route}${d.anchorSection ? `#lead-${d.anchorSection}` : ""}`
      : null;

  const isRail = placement === "rail";

  return (
    <motion.section
      aria-label="Наступний крок"
      className={cn(
        "rounded-[12px] border border-[var(--enver-border)] bg-[var(--enver-card)] p-4 shadow-[var(--enver-shadow)] transition duration-200",
        isRail && "enver-card-appear",
      )}
      whileHover={reduceMotion ? undefined : { y: -1, transition: { duration: 0.2 } }}
    >
      <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--enver-muted)]">
        Наступний крок
      </p>
      <div
        className={cn(
          "mt-2 flex flex-col gap-3",
          isRail ? "" : "sm:flex-row sm:items-center sm:justify-between",
        )}
      >
        <div className="min-w-0">
          <p
            className={cn(
              "font-semibold leading-snug text-[var(--enver-text)]",
              isRail ? "text-[15px]" : "text-[16px]",
            )}
          >
            {d.labelUa}
          </p>
          {d.disabled && d.reasonUa ? (
            <p className="mt-1 text-[12px] text-amber-800">{d.reasonUa}</p>
          ) : (
            <p className="mt-1 text-[12px] text-[var(--enver-muted)]">
              Один головний рух на цьому етапі.
            </p>
          )}
        </div>
        {href ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href={href}
                className={cn(
                  "enver-hover-lift enver-press inline-flex shrink-0 items-center justify-center gap-2 rounded-[12px] bg-[var(--enver-accent)] px-5 py-3 text-[14px] font-semibold text-white shadow-lg shadow-[var(--enver-accent)]/25 transition duration-200 hover:brightness-110",
                  isRail && "w-full justify-center py-3.5 text-[15px]",
                )}
              >
                Далі
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </TooltipTrigger>
            <TooltipContent side="left" className="max-w-[16rem]">
              Перейти до форми або розділу наступного кроку за правилами CRM Core.
            </TooltipContent>
          </Tooltip>
        ) : (
          <span className="inline-flex shrink-0 items-center rounded-[12px] border border-[var(--enver-border)] bg-[var(--enver-bg)] px-4 py-2.5 text-[12px] text-[var(--enver-muted)]">
            Дія недоступна
          </span>
        )}
      </div>
    </motion.section>
  );
}
