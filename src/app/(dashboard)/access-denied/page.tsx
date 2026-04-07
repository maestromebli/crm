import Link from "next/link";

export default function AccessDeniedPage() {
  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 rounded-2xl border border-amber-200 bg-amber-50/80 px-6 py-8 text-center">
      <h1 className="text-lg font-semibold text-[var(--enver-text)]">Немає доступу</h1>
      <p className="text-sm text-slate-600">
        У вашого акаунта недостатньо прав для цього розділу. Зверніться до
        адміністратора CRM.
      </p>
      <Link
        href="/leads"
        className="text-sm font-medium text-sky-700 underline hover:text-sky-900"
      >
        Перейти до лідів
      </Link>
    </div>
  );
}
