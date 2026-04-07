"use client";

export default function CrmDashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[calc(100vh-56px)] flex-col items-center justify-center bg-[var(--enver-bg)] px-4">
      <div className="max-w-md rounded-2xl border border-rose-200 bg-rose-50 px-6 py-8 text-center shadow-sm">
        <h1 className="text-lg font-semibold text-rose-900">
          Не вдалося завантажити дашборд
        </h1>
        <p className="mt-2 text-sm text-rose-800/90">
          {error.message || "Спробуйте ще раз або зверніться до адміністратора."}
        </p>
        <button
          type="button"
          onClick={() => reset()}
          className="mt-6 rounded-xl bg-rose-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-800"
        >
          Спробувати знову
        </button>
      </div>
    </div>
  );
}
