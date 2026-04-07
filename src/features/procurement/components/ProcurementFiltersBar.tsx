import { Input } from "../../../components/ui/input";

type Props = {
  query: string;
  onQuery: (v: string) => void;
};

export function ProcurementFiltersBar({ query, onQuery }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-3">
      <Input
        value={query}
        onChange={(e) => onQuery(e.target.value)}
        placeholder="Пошук за проєктом / постачальником / позицією"
        className="h-9 max-w-sm text-xs"
      />
    </div>
  );
}

