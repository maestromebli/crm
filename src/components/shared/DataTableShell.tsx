import type { ReactNode } from "react";

type DataTableShellProps = {
  columns: string[];
  children: ReactNode;
};

export function DataTableShell({ columns, children }: DataTableShellProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-[var(--enver-card)] shadow-sm">
      <table className="w-full text-left text-xs">
        <thead className="bg-slate-50 text-slate-600">
          <tr>
            {columns.map((c) => (
              <th key={c} className="px-3 py-2 font-medium">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

