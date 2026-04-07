"use client";

import type { InboxSlaState } from "../types";

type SlaBadgeProps = {
  state: InboxSlaState;
};

const slaConfig: Record<
  InboxSlaState,
  { label: string; className: string }
> = {
  ok: {
    label: "SLA в нормі",
    className:
      "bg-emerald-50 text-emerald-700 border-emerald-100",
  },
  warning: {
    label: "Soon overdue",
    className:
      "bg-amber-50 text-amber-700 border-amber-100",
  },
  overdue: {
    label: "Прострочено",
    className:
      "bg-rose-50 text-rose-700 border-rose-100",
  },
};

export function SlaBadge({ state }: SlaBadgeProps) {
  const cfg = slaConfig[state];

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${cfg.className}`}
    >
      {cfg.label}
    </span>
  );
}

