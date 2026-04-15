import Link from "next/link";

export default function HomePage() {
  return (
    <main className="flex min-h-screen items-center justify-center">
      <div className="rounded-xl border bg-white px-8 py-6 shadow-sm">
        <h1 className="text-xl font-semibold">Enver CRM</h1>
        <p className="mt-2 text-sm text-slate-600">
          Monorepo SaaS CRM для меблів під замовлення.
        </p>
        <div className="mt-4">
          <Link href="/production/scan" className="rounded-md bg-slate-900 px-3 py-2 text-sm text-white">
            Відкрити 3D скан-модуль
          </Link>
        </div>
      </div>
    </main>
  );
}

