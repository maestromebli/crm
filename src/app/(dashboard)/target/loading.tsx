export default function TargetLoading() {
  return (
    <div
      className="flex min-h-[calc(100vh-56px)] items-center justify-center bg-[var(--enver-bg)] px-4 text-sm text-slate-500"
      aria-busy="true"
      aria-label="Завантаження таргету"
    >
      Завантаження…
    </div>
  );
}
