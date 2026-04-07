"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { cn } from "../../../lib/utils";

const TABS = [
  { id: "today", label: "День" },
  { id: "week", label: "Тиждень" },
  { id: "month", label: "Місяць" },
  { id: "quarter", label: "Квартал" },
];

export function FinanceRangeTabs() {
  const sp = useSearchParams();
  const href = (financeRange: string) => {
    const u = new URLSearchParams(sp.toString());
    u.set("financeRange", financeRange);
    return `/crm/dashboard?${u.toString()}`;
  };
  const cur = sp.get("financeRange") ?? "month";

  return (
    <div className="inline-flex flex-wrap gap-1 rounded-xl border border-[var(--enver-border)] bg-[var(--enver-surface)] p-1">
      {TABS.map((t) => (
        <Link
          key={t.id}
          href={href(t.id)}
          className={cn(
            "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
            cur === t.id
              ? "bg-[var(--enver-card)] text-[var(--enver-text)] shadow-sm"
              : "text-[var(--enver-text-muted)] hover:text-[var(--enver-text)]",
          )}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}
