type SummaryCardProps = {
  label: string;
  value: string;
  tone?: "neutral" | "income" | "expense" | "warning";
  hint?: string;
};

const toneClass: Record<NonNullable<SummaryCardProps["tone"]>, string> = {
  neutral: "border-slate-200",
  income: "border-emerald-200",
  expense: "border-rose-200",
  warning: "border-amber-200",
};

export function SummaryCard({ label, value, tone = "neutral", hint }: SummaryCardProps) {
  return (
    <article className={`rounded-lg border bg-white p-3 ${toneClass[tone]}`}>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-slate-900">{value}</p>
      {hint ? <p className="mt-1 text-[11px] text-slate-500">{hint}</p> : null}
    </article>
  );
}

