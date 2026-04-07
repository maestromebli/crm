export default function CrmDashboardLoading() {
  return (
    <div className="min-h-[calc(100vh-56px)] animate-pulse bg-[var(--enver-bg)] px-4 py-8 md:px-8">
      <div className="mx-auto max-w-[1600px] space-y-6">
        <div className="h-8 w-64 rounded-lg bg-[var(--enver-surface)]" />
        <div className="h-4 w-96 max-w-full rounded bg-[var(--enver-surface)]" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-28 rounded-2xl bg-[var(--enver-surface)]"
            />
          ))}
        </div>
        <div className="grid gap-6 lg:grid-cols-12">
          <div className="h-96 rounded-2xl bg-[var(--enver-surface)] lg:col-span-7" />
          <div className="h-96 rounded-2xl bg-[var(--enver-surface)] lg:col-span-5" />
        </div>
      </div>
    </div>
  );
}
