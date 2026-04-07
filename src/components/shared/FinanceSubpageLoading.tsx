type Layout = "default" | "registryTable";

/** Загальний скелет для сторінок `/crm/finance/*` (PageHeader + контент). */
export function FinanceSubpageLoading({
  label,
  layout = "default",
}: {
  label: string;
  layout?: Layout;
}) {
  if (layout === "registryTable") {
    return (
      <div className="space-y-4 p-4" aria-busy="true" aria-label={label}>
        <div className="h-8 w-64 animate-pulse rounded-md bg-slate-200" />
        <div className="h-4 w-full max-w-xl animate-pulse rounded bg-slate-100" />
        <div className="h-[min(75vh,400px)] animate-pulse rounded-lg border border-slate-200 bg-slate-50" />
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4" aria-busy="true" aria-label={label}>
      <div className="h-8 w-56 max-w-[80%] animate-pulse rounded-md bg-slate-200" />
      <div className="h-4 w-full max-w-xl animate-pulse rounded-md bg-slate-100" />
      <div className="h-48 animate-pulse rounded-lg bg-slate-100" />
      <div className="h-32 animate-pulse rounded-lg bg-slate-50" />
    </div>
  );
}
