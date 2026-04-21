"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { LeadDetailRow } from "../../../../features/leads/queries";
import { resolveLeadNextStep } from "../../../../features/next-step";
import { postJson } from "@/lib/api/patch-json";
import { cn } from "../../../../lib/utils";

type Props = {
  lead: LeadDetailRow;
  /** `header` — компактний рядок під шапкою; `rail` — права колонка. */
  placement?: "default" | "rail" | "header";
  pulseEventAt?: number | null;
};

/**
 * Один домінантний CTA — «Наступний крок» (CRM Core), стадійна логіка.
 */
export function LeadHubNextStepBanner({
  lead,
  placement = "default",
  pulseEventAt = null,
}: Props) {
  const reduceMotion = useReducedMotion();
  const router = useRouter();
  const nextStep = resolveLeadNextStep(lead);
  const [convertBusy, setConvertBusy] = useState(false);
  const [convertErr, setConvertErr] = useState<string | null>(null);
  const isConvertToDealAction =
    nextStep.primary.id === "convert_to_deal" && !nextStep.primary.disabled;
  const href =
    nextStep.primary.kind === "navigate" && !nextStep.primary.disabled
      ? (nextStep.primary.href ?? null)
      : null;

  const isRail = placement === "rail";
  const isHeader = placement === "header";

  const handleConvertToDeal = useCallback(async () => {
    if (convertBusy || !isConvertToDealAction) return;
    setConvertErr(null);
    setConvertBusy(true);
    try {
      const j = await postJson<{ dealId?: string; error?: string }>(
        `/api/leads/${lead.id}/convert-to-deal`,
        {},
      );
      if (!j.dealId) {
        throw new Error(j.error ?? "Не вдалося створити замовлення");
      }
      router.push(`/deals/${j.dealId}/workspace?fromLead=1`);
      router.refresh();
    } catch (e) {
      setConvertErr(e instanceof Error ? e.message : "Не вдалося створити замовлення");
    } finally {
      setConvertBusy(false);
    }
  }, [convertBusy, isConvertToDealAction, lead.id, router]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((!href && !isConvertToDealAction) || event.defaultPrevented) return;
      if (event.key !== "Enter") return;
      const target = event.target as HTMLElement | null;
      if (
        target?.closest(
          "input, textarea, select, button, [contenteditable='true']",
        )
      ) {
        return;
      }
      event.preventDefault();
      if (isConvertToDealAction) {
        void handleConvertToDeal();
        return;
      }
      if (href) router.push(href);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleConvertToDeal, href, isConvertToDealAction, router]);

  const ctaButton = href || isConvertToDealAction ? (
    isConvertToDealAction ? (
      <button
        type="button"
        onClick={() => void handleConvertToDeal()}
        disabled={convertBusy}
        className={cn(
          "enver-hover-lift enver-press inline-flex shrink-0 items-center justify-center gap-2 rounded-[12px] bg-[var(--enver-accent)] font-semibold text-white shadow-lg shadow-[var(--enver-accent)]/25 transition duration-200 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70",
          isHeader
            ? "px-4 py-2.5 text-[13px]"
            : isRail
              ? "w-full justify-center px-5 py-3.5 text-[15px]"
              : "px-5 py-3 text-[14px]",
        )}
      >
        {convertBusy ? "Створення замовлення..." : "Наступний крок"}
        <ArrowRight className="h-4 w-4" aria-hidden />
      </button>
    ) : (
      <Link
        href={href!}
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
    )
  ) : (
    <span className="inline-flex shrink-0 items-center rounded-[12px] border border-[var(--enver-border)] bg-[var(--enver-bg)] px-3 py-2 text-[12px] text-[var(--enver-muted)]">
      Дія недоступна
    </span>
  );

  const blockerActions = nextStep.blockerActions.slice(0, 2);

  if (isHeader) {
    return (
      <motion.section
        aria-label="Наступний крок"
        className="lead-godmode-actionbar p-4"
        key={pulseEventAt ?? "steady"}
        initial={reduceMotion ? false : pulseEventAt ? { scale: 0.995, opacity: 0.9 } : false}
        animate={{ scale: 1, opacity: 1 }}
        whileHover={reduceMotion ? undefined : { y: -1, transition: { duration: 0.18 } }}
      >
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--enver-muted)]">
              AI Recommended Next Action
            </p>
            <p className="mt-1 text-[17px] font-semibold leading-snug text-[var(--enver-text)]">
              {nextStep.title}
            </p>
            {nextStep.primary.disabled && nextStep.primary.reason ? (
              <p className="mt-1 text-[12px] text-amber-800">{nextStep.primary.reason}</p>
            ) : (
              <p className="mt-1 text-[12px] text-[var(--enver-muted)]">
                Чому зараз: {nextStep.explanation}
              </p>
            )}
            {blockerActions.length > 0 ? (
              <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-rose-700">
                <span className="font-medium">Блокери:</span>
                {blockerActions.map((blocker) => (
                  <span key={blocker.id} className="inline-flex items-center gap-1">
                    <Link
                      href={blocker.href}
                      className="rounded-[8px] border border-rose-200 bg-rose-50 px-1.5 py-0.5 text-rose-800 underline decoration-rose-300 underline-offset-2 transition hover:bg-rose-100 hover:decoration-rose-500"
                    >
                      {blocker.label}
                    </Link>
                    {blocker.aiHref ? (
                      <Link
                        href={blocker.aiHref}
                        className="rounded-[8px] border border-violet-200 bg-violet-50 px-1.5 py-0.5 text-violet-700 transition hover:bg-violet-100"
                      >
                        ШІ
                      </Link>
                    ) : null}
                  </span>
                ))}
              </div>
            ) : null}
            {nextStep.aiNote ? (
              <p className="mt-1 text-[11px] text-[var(--enver-muted)]/90">
                AI: {nextStep.aiNote}
              </p>
            ) : null}
            {convertErr ? (
              <p className="mt-1 text-[11px] text-rose-700">{convertErr}</p>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <div className="hidden rounded-[10px] bg-black/5 px-2 py-1 text-[10px] text-[var(--enver-muted)] md:block">
              Enter - виконати
            </div>
            {ctaButton}
          </div>
        </div>
        {nextStep.secondary.length > 0 ? (
          <details className="mt-3">
            <summary className="cursor-pointer list-none text-[11px] font-medium text-[var(--enver-muted)] marker:hidden [&::-webkit-details-marker]:hidden">
              Інші дії
            </summary>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {nextStep.secondary.map((action) =>
                action.href ? (
                  <Link
                    key={action.id}
                    href={action.href}
                    className="rounded-[10px] border border-[var(--enver-border)] bg-[var(--enver-card)] px-2.5 py-1.5 text-[11px] text-[var(--enver-text)] transition hover:bg-[var(--enver-hover)]"
                  >
                    {action.label}
                  </Link>
                ) : null,
              )}
            </div>
          </details>
        ) : null}
        {pulseEventAt ? (
          <p className="mt-2 text-[10px] text-emerald-700">Оновлено - наступний крок переглянуто</p>
        ) : null}
      </motion.section>
    );
  }

  return (
    <motion.section
      aria-label="Наступний крок"
      className={cn(
        "leadhub-card p-4 transition duration-200",
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
          {convertErr ? (
            <p className="mt-1 text-[11px] text-rose-700">{convertErr}</p>
          ) : null}
          {blockerActions.length > 0 ? (
            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-rose-700">
              <span className="font-medium">Блокери:</span>
              {blockerActions.map((blocker) => (
                <span key={blocker.id} className="inline-flex items-center gap-1">
                  <Link
                    href={blocker.href}
                    className="rounded-[8px] border border-rose-200 bg-rose-50 px-1.5 py-0.5 text-rose-800 underline decoration-rose-300 underline-offset-2 transition hover:bg-rose-100 hover:decoration-rose-500"
                  >
                    {blocker.label}
                  </Link>
                  {blocker.aiHref ? (
                    <Link
                      href={blocker.aiHref}
                      className="rounded-[8px] border border-violet-200 bg-violet-50 px-1.5 py-0.5 text-violet-700 transition hover:bg-violet-100"
                    >
                      ШІ
                    </Link>
                  ) : null}
                </span>
              ))}
            </div>
          ) : null}
        </div>
        {ctaButton}
      </div>
    </motion.section>
  );
}
