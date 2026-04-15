type SummaryCardProps = {
  label: string;
  value: string;
  tone?: "neutral" | "income" | "expense" | "warning";
  hint?: string;
  /** Якщо задано — картка стає кнопкою з фокусом і ховером. */
  onClick?: () => void;
  /** Є збережений запис (наприклад у БД) до цієї метрики. */
  hasSavedNote?: boolean;
};

const toneClass: Record<NonNullable<SummaryCardProps["tone"]>, string> = {
  neutral: "border-[var(--enver-border)]",
  income: "border-emerald-200/80",
  expense: "border-rose-200/80",
  warning: "border-amber-200/80",
};

const interactiveClass =
  "w-full cursor-pointer text-left transition hover:bg-[var(--enver-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400";

export function SummaryCard({
  label,
  value,
  tone = "neutral",
  hint,
  onClick,
  hasSavedNote,
}: SummaryCardProps) {
  const shell = `relative rounded-lg border bg-[var(--enver-card)] p-3 ${toneClass[tone]} ${onClick ? interactiveClass : ""}`;
  const noteDot =
    hasSavedNote === true ? (
      <span
        className="absolute right-2 top-2 h-2 w-2 rounded-full bg-blue-500 ring-2 ring-white"
        title="Є збережені уточнення"
        aria-hidden
      />
    ) : null;
  const body = (
    <>
      {noteDot}
      <p className="text-xs text-[var(--enver-text-muted)]">{label}</p>
      <p className="mt-1 text-lg font-semibold text-[var(--enver-text)]">{value}</p>
      {hint ? <p className="mt-1 text-[11px] text-[var(--enver-text-muted)]">{hint}</p> : null}
    </>
  );
  if (onClick) {
    return (
      <button type="button" className={shell} onClick={onClick} aria-label={`${label}: ${value}`}>
        {body}
      </button>
    );
  }
  return <article className={shell}>{body}</article>;
}
