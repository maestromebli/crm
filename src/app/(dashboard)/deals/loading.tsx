export default function DealsLoading() {
  return (
    <div className="flex min-h-[calc(100vh-56px)] flex-col bg-slate-50 px-3 py-4 md:px-6">
      <div className="mx-auto w-full max-w-6xl space-y-4">
        <div className="h-4 w-48 animate-pulse rounded bg-slate-200" />
        <div className="h-36 animate-pulse rounded-2xl bg-slate-200/80" />
        <div className="h-12 animate-pulse rounded-2xl bg-slate-200/70" />
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-2xl bg-slate-200/60"
            />
          ))}
        </div>
        <div className="h-96 animate-pulse rounded-2xl bg-slate-200/50" />
      </div>
    </div>
  );
}
