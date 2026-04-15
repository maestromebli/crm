"use client";

import { useMemo, useState } from "react";
import type {
  DealSmartInsight,
  DealWarning,
} from "../../features/deal-workspace/deal-view-selectors";
import { cn } from "../../lib/utils";

type Props = {
  insights: DealSmartInsight[];
  warnings: DealWarning[];
};

const SECTION_LABELS: Record<DealSmartInsight["section"], string> = {
  critical: "Критично",
  recommendations: "Рекомендації",
  readiness: "Готовність",
  history: "Історія/сигнали",
};

export function DealSmartInsights({ insights, warnings }: Props) {
  const [open, setOpen] = useState(false);
  const grouped = useMemo(() => {
    return (["critical", "recommendations", "readiness", "history"] as const).map(
      (section) => ({
        section,
        label: SECTION_LABELS[section],
        items: insights.filter((item) => item.section === section),
      }),
    );
  }, [insights]);
  const top = insights.slice(0, 3);

  return (
    <section className="rounded-2xl border border-[var(--enver-border)] bg-[var(--enver-card)] p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--enver-muted)]">
          Smart insights
        </h3>
        <button
          type="button"
          onClick={() => setOpen((state) => !state)}
          className="rounded-lg border border-[var(--enver-border)] px-2 py-1 text-[11px] font-medium text-[var(--enver-text-muted)] hover:bg-[var(--enver-hover)]"
        >
          {open ? "Згорнути" : "Розгорнути"}
        </button>
      </div>

      {!open ? (
        <ul className="mt-2 space-y-1.5">
          {top.map((item) => (
            <li key={item.id} className="text-xs text-[var(--enver-text-muted)]">
              - {item.title}
            </li>
          ))}
          {warnings.slice(0, 1).map((warning) => (
            <li key={warning.id} className="text-xs text-[var(--enver-text-muted)]">
              - Увага: {warning.title}
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-3 space-y-3">
          {grouped.map((section) => (
            <div key={section.section}>
              <p className="text-[11px] font-semibold text-[var(--enver-text)]">{section.label}</p>
              {section.items.length > 0 ? (
                <ul className="mt-1 space-y-1">
                  {section.items.map((item) => (
                    <li
                      key={item.id}
                      className={cn(
                        "rounded-lg px-2 py-1 text-xs",
                        item.severity === "critical" && "bg-rose-50 text-rose-900",
                        item.severity === "warning" && "bg-amber-50 text-amber-900",
                        item.severity === "info" && "bg-[var(--enver-surface)] text-[var(--enver-text-muted)]",
                      )}
                    >
                      {item.title}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-xs text-[var(--enver-muted)]">Немає пунктів</p>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
