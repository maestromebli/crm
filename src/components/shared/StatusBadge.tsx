type StatusTone = "neutral" | "success" | "warning" | "danger" | "info";

type StatusBadgeProps = {
  label: string;
  tone?: StatusTone;
};

const toneClass: Record<StatusTone, string> = {
  neutral: "border border-[var(--enver-border)] bg-[var(--enver-surface)] text-[var(--enver-text-muted)]",
  success: "border border-emerald-200/80 bg-emerald-50 text-emerald-800",
  warning: "border border-amber-200/80 bg-amber-50 text-amber-800",
  danger: "border border-rose-200/80 bg-rose-50 text-rose-800",
  info: "border border-sky-200/80 bg-sky-50 text-sky-800",
};

export function StatusBadge({ label, tone = "neutral" }: StatusBadgeProps) {
  return (
    <span className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-medium ${toneClass[tone]}`}>
      {label}
    </span>
  );
}

