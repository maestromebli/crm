import type { ReactNode } from "react";
import { Lightbulb } from "lucide-react";

type Props = {
  title?: string;
  children: ReactNode;
  variant?: "info" | "tip";
};

/** Коротка підказка бухгалтеру / керівнику без зайвого шуму. */
export function FinanceInsightCallout({
  title = "Навіщо цей розділ",
  children,
  variant = "info",
}: Props) {
  const ring = variant === "tip" ? "ring-amber-200/80 bg-amber-50/50" : "ring-blue-200/70 bg-blue-50/40";
  return (
    <aside
      className={`flex gap-3 rounded-xl border border-slate-200/80 p-4 ring-1 ${ring}`}
      role="note"
    >
      <span className="mt-0.5 shrink-0 rounded-lg bg-[var(--enver-card)]/80 p-1.5 shadow-sm ring-1 ring-slate-200/60">
        <Lightbulb
          className={`h-4 w-4 ${variant === "tip" ? "text-amber-600" : "text-blue-600"}`}
          aria-hidden
        />
      </span>
      <div className="min-w-0 text-xs leading-relaxed text-slate-700">
        <p className="font-semibold text-[var(--enver-text)]">{title}</p>
        <div className="mt-1.5 space-y-1.5 [&_ul]:list-inside [&_ul]:list-disc [&_ul]:space-y-1">{children}</div>
      </div>
    </aside>
  );
}
