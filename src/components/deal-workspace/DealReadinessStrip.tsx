"use client";

import type { DealWorkspacePayload } from "../../features/deal-workspace/types";
import { useDealReadinessStrip } from "../../hooks/deal-workspace/useDealReadinessStrip";
import { useDealWarnings } from "../../hooks/deal-workspace/useDealWarnings";
import { cn } from "../../lib/utils";

type Props = {
  data: DealWorkspacePayload;
};

function Chip({
  ok,
  label,
}: {
  ok: boolean;
  label: string;
}) {
  return (
    <span
      className={cn(
        "rounded-full border px-2 py-0.5 text-[10px] font-medium",
        ok
          ? "border-emerald-200 bg-emerald-50 text-emerald-900"
          : "border-slate-200 bg-slate-50 text-slate-500",
      )}
    >
      {label}
    </span>
  );
}

export function DealReadinessStrip({ data }: Props) {
  const r = useDealReadinessStrip(data);
  const warnings = useDealWarnings(data);
  const critical = warnings.some((w) => w.level === "critical");
  const hasWarning = warnings.some((w) => w.level === "warning");

  const flow = metaHealth(critical, hasWarning, r);

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/90 px-3 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          Готовність
        </span>
        <Chip ok={r.contact} label="Контакт" />
        <Chip ok={r.qualification} label="Кваліфікація" />
        <Chip ok={r.estimate} label="Смета" />
        <Chip ok={r.quote} label="КП" />
        <Chip ok={r.contract} label="Договір" />
        <Chip ok={r.payment} label="Оплата" />
        <span
          className={cn(
            "ml-auto rounded-full border px-2 py-0.5 text-[10px] font-semibold",
            flow.className,
          )}
        >
          {flow.label}
        </span>
      </div>
    </div>
  );
}

type Readiness = {
  contact: boolean;
  qualification: boolean;
  estimate: boolean;
  quote: boolean;
  contract: boolean;
  payment: boolean;
  paymentComplete: boolean;
};

function metaHealth(
  critical: boolean,
  hasWarning: boolean,
  r: Readiness,
): { label: string; className: string } {
  if (critical) {
    return {
      label: "Ризик / блокер",
      className: "border-rose-200 bg-rose-100 text-rose-900",
    };
  }
  if (hasWarning) {
    return {
      label: "Потрібна увага",
      className: "border-amber-200 bg-amber-100 text-amber-950",
    };
  }
  const readyish =
    r.contact &&
    r.qualification &&
    r.estimate &&
    r.quote &&
    r.contract &&
    r.paymentComplete;
  if (readyish) {
    return {
      label: "Готово до передачі",
      className: "border-emerald-200 bg-emerald-100 text-emerald-900",
    };
  }
  return {
    label: "В роботі",
    className: "border-slate-200 bg-[var(--enver-card)] text-slate-700",
  };
}
