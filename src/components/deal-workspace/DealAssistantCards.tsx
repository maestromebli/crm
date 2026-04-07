"use client";

import type { DealWorkspacePayload } from "../../features/deal-workspace/types";
import type { DealWorkspaceTabId } from "../../features/deal-workspace/types";
import { useDealAssistantCards } from "../../hooks/deal-workspace/useDealAssistantCards";
import { cn } from "../../lib/utils";

type Props = {
  data: DealWorkspacePayload;
  onTab: (id: DealWorkspaceTabId) => void;
  onRequestEditHeader?: () => void;
};

const toneRing: Record<string, string> = {
  neutral: "border-slate-200 bg-[var(--enver-card)]",
  amber: "border-amber-200 bg-amber-50/80",
  rose: "border-rose-200 bg-rose-50/90",
  sky: "border-sky-200 bg-sky-50/80",
};

export function DealAssistantCards({
  data,
  onTab,
  onRequestEditHeader,
}: Props) {
  const cards = useDealAssistantCards(data);
  if (cards.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        Підказки
      </p>
      <ul className="grid gap-2 sm:grid-cols-2">
        {cards.map((c) => (
          <li
            key={c.id}
            className={cn(
              "rounded-xl border px-3 py-2 shadow-sm shadow-slate-900/5",
              toneRing[c.tone] ?? toneRing.neutral,
            )}
          >
            <p className="text-xs font-semibold text-[var(--enver-text)]">{c.title}</p>
            <p className="mt-0.5 text-[11px] leading-snug text-slate-600">
              {c.body}
            </p>
            {c.ctaTab || c.ctaLabel ? (
              <button
                type="button"
                className="mt-2 text-[11px] font-medium text-[var(--enver-text)] underline decoration-slate-300 underline-offset-2 hover:decoration-slate-600"
                onClick={() => {
                  if (c.ctaTab) onTab(c.ctaTab);
                  else onRequestEditHeader?.();
                }}
              >
                {c.ctaLabel ?? "Відкрити"}
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
