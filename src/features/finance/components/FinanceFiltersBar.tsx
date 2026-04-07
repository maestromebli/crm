import { Input } from "../../../components/ui/input";

type Props = {
  period: string;
  onPeriod: (v: string) => void;
  query: string;
  onQuery: (v: string) => void;
};

export function FinanceFiltersBar({ period, onPeriod, query, onQuery }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-3">
      <select
        className="h-9 rounded-md border border-slate-200 px-2 text-xs"
        value={period}
        onChange={(e) => onPeriod(e.target.value)}
      >
        <option value="month">Період: 30 днів</option>
        <option value="quarter">Період: 90 днів</option>
        <option value="year">Період: 365 днів</option>
        <option value="all">Період: весь час</option>
      </select>
      <Input
        value={query}
        onChange={(e) => onQuery(e.target.value)}
        placeholder="Пошук за проєктом / документом / контрагентом"
        className="h-9 max-w-sm text-xs"
      />
    </div>
  );
}

