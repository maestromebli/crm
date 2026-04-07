import { Database, Sparkles } from "lucide-react";

type Props = {
  source: "db" | "mock";
  className?: string;
};

/** Показує, чи дані з PostgreSQL, чи демонстраційні — одразу зрозуміло бухгалтеру та керівнику. */
export function FinanceDataSourceBadge({ source, className = "" }: Props) {
  if (source === "db") {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-900 ring-1 ring-emerald-200/90 ${className}`}
      >
        <Database className="h-3.5 w-3.5 shrink-0 opacity-90" aria-hidden />
        Живі дані з БД
      </span>
    );
  }
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-900 ring-1 ring-amber-200/90 ${className}`}
    >
      <Sparkles className="h-3.5 w-3.5 shrink-0 opacity-90" aria-hidden />
      Демо-приклад
    </span>
  );
}
