import type { ReactNode } from "react";

type Props = {
  title: string;
  subtitle?: string;
  /** Додатковий рядок над таблицею (фільтри, лічильник). */
  toolbar?: ReactNode;
  children: ReactNode;
  /** Для caption / доступності. */
  tableLabel: string;
};

/**
 * Обгортка для таблиць: заголовок, тулбар, горизонтальний скрол, єдиний вигляд з усіма розділами.
 */
export function FinanceTableShell({ title, subtitle, toolbar, children, tableLabel }: Props) {
  return (
    <section
      className="overflow-hidden rounded-2xl border border-slate-200/90 bg-[var(--enver-card)] shadow-sm ring-1 ring-slate-900/[0.04]"
      aria-label={tableLabel}
    >
      <div className="border-b border-slate-100 bg-slate-50/90 px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-[var(--enver-text)]">{title}</h2>
            {subtitle ? <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p> : null}
          </div>
          {toolbar ? <div className="flex flex-wrap items-center gap-2">{toolbar}</div> : null}
        </div>
      </div>
      <div className="overflow-x-auto">{children}</div>
    </section>
  );
}
