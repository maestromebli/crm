import type { LeadListRow } from "../../features/leads/queries";
import { duplicateLeadIdsByPhone } from "../../lib/leads/lead-row-meta";
import { LeadRow } from "./LeadRow";

export function groupLeadsBySource(rows: LeadListRow[]) {
  const m = new Map<string, LeadListRow[]>();
  for (const r of rows) {
    const s = r.source || "—";
    if (!m.has(s)) m.set(s, []);
    m.get(s)!.push(r);
  }
  return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}

type LeadsListProps = {
  rows: LeadListRow[];
  /** Якщо true — групувати за джерелом (view sources). */
  groupBySource?: boolean;
};

export function LeadsList({ rows, groupBySource = false }: LeadsListProps) {
  const dupIds = duplicateLeadIdsByPhone(rows);

  const table = (list: LeadListRow[]) => (
    <div className="overflow-x-auto rounded-2xl border border-[var(--enver-border)] bg-[var(--enver-card)]">
      <table className="w-full min-w-[960px] text-left text-xs">
        <caption className="sr-only">
          Таблиця лідів: назва, кроки, дати, статус відповіді та швидкі дії
        </caption>
        <thead className="sticky top-0 z-10 border-b border-[var(--enver-border)] bg-[var(--enver-surface)]/95 text-[10px] font-semibold uppercase tracking-wide text-[var(--enver-muted)] backdrop-blur-sm">
          <tr>
            <th scope="col" className="px-3 py-3 text-left" title="Назва та ключові сигнали">
              Лід
            </th>
            <th scope="col" className="px-3 py-3" title="Що зробити далі">
              Наступний крок
            </th>
            <th scope="col" className="px-3 py-3 whitespace-nowrap" title="Запланований контакт">
              Контакт до
            </th>
            <th scope="col" className="px-3 py-3 whitespace-nowrap" title="Останній дотик / дія">
              Активність
            </th>
            <th scope="col" className="px-3 py-3" title="Статус відповіді клієнта">
              Відповідь
            </th>
            <th scope="col" className="px-3 py-3 text-right">
              Дії
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--enver-border)]">
          {list.map((lead) => (
            <LeadRow
              key={lead.id}
              lead={lead}
              duplicatePhone={dupIds.has(lead.id)}
            />
          ))}
        </tbody>
      </table>
    </div>
  );

  if (groupBySource && rows.length > 0) {
    return (
      <div className="space-y-6">
        {groupLeadsBySource(rows).map(([source, list]) => (
          <section key={source}>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              {source}{" "}
              <span className="font-normal text-slate-400">({list.length})</span>
            </h2>
            {table(list)}
          </section>
        ))}
      </div>
    );
  }

  return table(rows);
}
