import type { ReactNode } from "react";

type DataTableShellProps = {
  columns: string[];
  children: ReactNode;
};

export function DataTableShell({ columns, children }: DataTableShellProps) {
  return (
    <div className="enver-card-appear enver-panel overflow-hidden">
      <table className="w-full text-left text-sm">
        <thead className="bg-[var(--enver-surface)] text-[var(--enver-text-muted)]">
          <tr>
            {columns.map((c) => (
              <th
                key={c}
                className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wide"
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="[&_td]:px-3 [&_td]:py-2.5 [&_td]:align-top [&_tr]:border-t [&_tr]:border-[var(--enver-border)] [&_tr]:enver-row-hover [&_tr]:enver-table-row-state">
          {children}
        </tbody>
      </table>
    </div>
  );
}

