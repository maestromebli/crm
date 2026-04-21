import Link from "next/link";

export type ProductionSubpageRow = {
  id: string;
  title: string;
  client: string;
  owner: string;
  extra?: string;
};

export function ProductionSubpageTable({
  rows,
  emptyText,
}: {
  rows: ProductionSubpageRow[];
  emptyText: string;
}) {
  if (rows.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-8 text-center text-sm text-slate-500">
        {emptyText}
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-[var(--enver-card)] shadow-sm">
      <table className="w-full min-w-[640px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-600">
            <th className="px-3 py-2.5">Замовлення</th>
            <th className="px-3 py-2.5">Клієнт</th>
            <th className="px-3 py-2.5">Відповідальний</th>
            <th className="px-3 py-2.5">Додатково</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-slate-100 hover:bg-[var(--enver-hover)]/80">
              <td className="px-3 py-2.5">
                <Link
                  href={`/deals/${r.id}/workspace`}
                  className="font-medium text-[var(--enver-text)] underline-offset-2 hover:underline"
                >
                  {r.title}
                </Link>
              </td>
              <td className="px-3 py-2.5 text-slate-700">{r.client}</td>
              <td className="px-3 py-2.5 text-slate-600">{r.owner}</td>
              <td className="px-3 py-2.5 text-slate-500">{r.extra ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
