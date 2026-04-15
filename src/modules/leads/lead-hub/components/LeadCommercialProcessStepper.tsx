"use client";

import Link from "next/link";
import type { LeadDetailRow } from "../../../../features/leads/queries";
import { cn } from "../../../../lib/utils";

export type LeadCommercialStep =
  | "hub"
  | "contact"
  | "pricing"
  | "deal";

type Props = {
  lead: LeadDetailRow;
  active: LeadCommercialStep;
  className?: string;
};

function contactFilled(l: LeadDetailRow): boolean {
  return !!(
    l.contactId ||
    l.contact?.phone?.trim() ||
    l.phone?.trim() ||
    l.contact?.fullName?.trim() ||
    l.contactName?.trim()
  );
}

type StepDef = {
  id: LeadCommercialStep;
  label: string;
  complete: (l: LeadDetailRow) => boolean;
  disabled?: (l: LeadDetailRow) => boolean;
};

const STEP_DEFS: StepDef[] = [
  { id: "hub", label: "Хаб", complete: () => true },
  { id: "contact", label: "Контакт", complete: contactFilled },
  {
    id: "pricing",
    label: "Розрахунок / КП",
    complete: (l) =>
      l.estimates.length > 0 || l.proposals.length > 0 || !!l.activeProposalId,
  },
  {
    id: "deal",
    label: "Угода",
    complete: (l) => !!l.dealId,
    disabled: (l) => !l.dealId,
  },
];

function hrefForStep(
  stepId: LeadCommercialStep,
  leadId: string,
  lead: LeadDetailRow,
): string {
  if (stepId === "hub") return `/leads/${leadId}`;
  if (stepId === "contact") return `/leads/${leadId}/contact`;
  if (stepId === "pricing") return `/leads/${leadId}/pricing`;
  if (stepId === "deal" && lead.dealId) {
    return `/deals/${lead.dealId}/workspace`;
  }
  return `/leads/${leadId}`;
}

/** Компактна лінійна навігація по етапах без зайвих панелей. */
export function LeadCommercialProcessStepper({
  lead,
  active,
  className,
}: Props) {
  const id = lead.id;

  return (
    <nav
      className={cn(
        "text-[11px] leading-snug text-[var(--enver-muted)]",
        className,
      )}
      aria-label="Етапи комерційного процесу"
    >
      <ol className="flex flex-wrap items-center gap-x-1 gap-y-1">
        {STEP_DEFS.map((step, idx) => {
          const isActive = active === step.id;
          const blocked = step.disabled?.(lead) === true;
          const href = hrefForStep(step.id, id, lead);

          return (
            <li key={step.id} className="flex items-center gap-x-1">
              {idx > 0 ? (
                <span className="text-[var(--enver-border)]" aria-hidden>
                  ·
                </span>
              ) : null}
              {blocked && step.id === "deal" ? (
                <span
                  className={cn(
                    "cursor-default",
                    isActive && "text-[var(--enver-text)]",
                  )}
                >
                  {step.label}
                </span>
              ) : (
                <Link
                  href={href}
                  className={cn(
                    "transition-colors hover:text-[var(--enver-text)]",
                    isActive
                      ? "font-medium text-[var(--enver-text)]"
                      : "text-[var(--enver-muted)]",
                  )}
                  aria-current={isActive ? "step" : undefined}
                >
                  {step.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
