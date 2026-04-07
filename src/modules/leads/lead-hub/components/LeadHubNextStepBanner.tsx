"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import type { LeadDetailRow } from "../../../../features/leads/queries";
import { resolveLeadNextStep } from "../../../../features/next-step";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "../../../../lib/utils";

type Props = {
  lead: LeadDetailRow;
  /** `header` — компактний рядок під шапкою; `rail` — права колонка. */
  placement?: "default" | "rail" | "header";
};

/**
 * Один домінантний CTA — «Наступний крок» (CRM Core), стадійна логіка.
 */
export function LeadHubNextStepBanner({ lead, placement = "default" }: Props) {
  const reduceMotion = useReducedMotion();
  const nextStep = resolveLeadNextStep(lead);
  const href =
    nextStep.primary.kind === "navigate" && !nextStep.primary.disabled
      ? (nextStep.primary.href ?? null)
      : null;

  const isRail = placement === "rail";
  const isHeader = placement === "header";

  const ctaButton = href ? (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          href={href}
          className={cn(
            "enver-hover-lift enver-press inline-flex shrink-0 items-center justify-center gap-2 rounded-[12px] bg-[var(--enver-accent)] font-semibold text-white shadow-lg shadow-[var(--enver-accent)]/25 transition duration-200 hover:brightness-110",
            isHeader
              ? "px-4 py-2.5 text-[13px]"
              : isRail
                ? "w-full justify-center px-5 py-3.5 text-[15px]"
                : "px-5 py-3 text-[14px]",
          )}
        >
          Наступний крок
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </TooltipTrigger>
      <TooltipContent side="left" className="max-w-[16rem]">
        Перейти до форми або розділу наступного кроку за правилами CRM Core.
      </TooltipContent>
    </Tooltip>
  ) : (
    <span className="inline-flex shrink-0 items-center rounded-[12px] border border-[var(--enver-border)] bg-[var(--enver-bg)] px-3 py-2 text-[12px] text-[var(--enver-muted)]">
      Дія недоступна
    </span>
  );

  if (isHeader) {
    return (
      <motion.section
        aria-label="Наступний крок"
        className="rounded-[12px] border border-[var(--enver-border)] bg-[var(--enver-card)]/80 p-3 shadow-sm"
        whileHover={reduceMotion ? undefined : { y: -1, transition: { duration: 0.18 } }}
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--enver-muted)]">
              Наступний крок
            </p>
            <p className="mt-0.5 text-[14px] font-semibold leading-snug text-[var(--enver-text)]">
              {nextStep.title}
            </p>
            {nextStep.primary.disabled && nextStep.primary.reason ? (
              <p className="mt-1 text-[11px] text-amber-800">{nextStep.primary.reason}</p>
            ) : (
              <p className="mt-1 text-[11px] text-[var(--enver-muted)]">
                {nextStep.explanation}
              </p>
            )}
            {nextStep.blockers.length > 0 ? (
              <p className="mt-1 text-[11px] text-rose-700">
                Блокери: {nextStep.blockers.slice(0, 2).join(" · ")}
              </p>
            ) : null}
          </div>
          <div className="shrink-0">{ctaButton}</div>
        </div>
      </motion.section>
    );
  }

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
            {nextStep.title}
          </p>
          {nextStep.primary.disabled && nextStep.primary.reason ? (
            <p className="mt-1 text-[12px] text-amber-800">{nextStep.primary.reason}</p>
          ) : (
            <p className="mt-1 text-[12px] text-[var(--enver-muted)]">
              {nextStep.explanation}
            </p>
          )}
          <p className="mt-1 text-[11px] text-slate-500">
            Прогрес етапу: {nextStep.progressPercent}%
          </p>
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
                Наступний крок
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
