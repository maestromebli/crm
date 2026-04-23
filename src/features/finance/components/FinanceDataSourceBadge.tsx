import { Database } from "lucide-react";

type Props = {
  source: "db";
  className?: string;
};

/** Показує, що дані надходять з PostgreSQL. */
export function FinanceDataSourceBadge({ source, className = "" }: Props) {
  if (source !== "db") return null;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-900 ring-1 ring-emerald-200/90 ${className}`}
    >
      <Database className="h-3.5 w-3.5 shrink-0 opacity-90" aria-hidden />
      Живі дані з БД
    </span>
  );
}
