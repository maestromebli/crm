import Link from "next/link";
import type { LeadKpiCounts } from "../../features/leads/queries";

type Props = {
  counts: LeadKpiCounts;
};

export function LeadsKpiStrip({ counts }: Props) {
  const items: {
    href: string;
    label: string;
    value: number;
    tone: "slate" | "amber" | "rose" | "emerald";
  }[] = [
    {
      href: "/leads/new",
      label: "Нові",
      value: counts.new,
      tone: "slate",
    },
    {
      href: "/leads/no-response",
      label: "Без відповіді",
      value: counts.noResponse,
      tone: "rose",
    },
    {
      href: "/leads/no-next-step",
      label: "Без кроку",
      value: counts.noNextStep,
      tone: "amber",
    },
    {
      href: "/leads/unassigned",
      label: "На розподіл",
      value: counts.unassigned,
      tone: "amber",
    },
    {
      href: "/leads/converted",
      label: "Конвертовані",
      value: counts.converted,
      tone: "emerald",
    },
    {
      href: "/leads/lost",
      label: "Втрати / архів",
      value: counts.lost,
      tone: "slate",
    },
  ];

  const ring: Record<(typeof items)[number]["tone"], string> = {
    slate: "border-slate-200 hover:border-slate-300",
    amber: "border-amber-200 hover:border-amber-300",
    rose: "border-rose-200 hover:border-rose-300",
    emerald: "border-emerald-200 hover:border-emerald-300",
  };

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
      {items.map((it) => (
        <Link
          key={it.href}
          href={it.href}
          className={`rounded-xl border bg-[var(--enver-card)] px-3 py-2.5 shadow-sm transition ${ring[it.tone]}`}
        >
          <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
            {it.label}
          </p>
          <p className="mt-0.5 text-xl font-semibold tabular-nums text-[var(--enver-text)]">
            {it.value}
          </p>
        </Link>
      ))}
    </div>
  );
}
