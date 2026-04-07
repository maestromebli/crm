import type { ReactNode } from "react";

type DataTableShellProps = {
  columns: string[];
  children: ReactNode;
};

export function DataTableShell({ columns, children }: DataTableShellProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-[var(--enver-card)] shadow-sm">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50 text-slate-600">
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
        <tbody className="[&_td]:px-3 [&_td]:py-2.5 [&_td]:align-top [&_tr]:border-t [&_tr]:border-slate-100">
          {children}
        </tbody>
      </table>
    </div>
  );
}

