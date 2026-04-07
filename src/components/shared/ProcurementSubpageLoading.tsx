/** Скелети для `/crm/procurement` та `/crm/procurement/[projectId]`. */

export function ProcurementOverviewLoading() {
  return (
    <div className="space-y-4 p-4" aria-busy="true" aria-label="Завантаження модуля закупівель">
      <div className="h-10 w-56 animate-pulse rounded-lg bg-slate-200" />
      <div className="h-4 max-w-xl animate-pulse rounded-md bg-slate-100" />
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-xl border border-slate-100 bg-slate-50" />
        ))}
      </div>
      <div className="h-24 animate-pulse rounded-xl border border-slate-200 bg-slate-100" />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="h-72 animate-pulse rounded-xl bg-slate-50" />
        <div className="h-48 animate-pulse rounded-xl bg-slate-50" />
      </div>
    </div>
  );
}

export function ProcurementProjectLoading() {
  return (
    <div className="space-y-4 p-4" aria-busy="true" aria-label="Завантаження закупівель проєкту">
      <div className="h-10 w-2/3 max-w-lg animate-pulse rounded-lg bg-slate-200" />
      <div className="flex flex-wrap gap-2">
        <div className="h-8 w-32 animate-pulse rounded-md bg-slate-100" />
        <div className="h-4 flex-1 animate-pulse rounded bg-slate-50" />
      </div>
      <div className="grid gap-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-8">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-16 animate-pulse rounded-xl border border-slate-100 bg-slate-50" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="h-96 animate-pulse rounded-xl bg-slate-50" />
        <div className="h-48 animate-pulse rounded-xl bg-slate-50" />
      </div>
    </div>
  );
}
