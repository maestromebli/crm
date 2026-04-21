import Link from "next/link";

const readiness = [
  { id: "contract", label: "Договір погоджено", done: true },
  { id: "payment", label: "Передоплата отримана", done: false },
  { id: "files", label: "Пакет файлів готовий", done: true },
  { id: "handoff", label: "Передача у виробництво", done: false },
];

const timeline = [
  "Погоджено конфігурацію кухні з клієнтом.",
  "Оновлено кошторис і додано монтажні роботи.",
  "Підготовлено пакет файлів для виробництва.",
];

export function DealWorkspaceDemoPage() {
  const completed = readiness.filter((item) => item.done).length;
  const progress = Math.round((completed / readiness.length) * 100);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-4 md:p-6">
      <section className="rounded-3xl border border-slate-200 bg-[var(--enver-card)] p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">
          DEMO WORKSPACE
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">
          Демо робочого місця замовлення
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          Це тестовий режим для перегляду структури воркспейсу без доступу до
          реальних даних клієнтів.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            href="/deals"
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Повернутись до списку замовлень
          </Link>
          <span className="rounded-xl bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-700">
            Готовність: {progress}%
          </span>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <article className="rounded-3xl border border-slate-200 bg-[var(--enver-card)] p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">
            Чекліст готовності
          </h2>
          <ul className="mt-3 space-y-2">
            {readiness.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-sm"
              >
                <span className="text-slate-700">{item.label}</span>
                <span
                  className={
                    item.done
                      ? "font-medium text-emerald-600"
                      : "font-medium text-amber-600"
                  }
                >
                  {item.done ? "Виконано" : "Очікує"}
                </span>
              </li>
            ))}
          </ul>
        </article>

        <article className="rounded-3xl border border-slate-200 bg-[var(--enver-card)] p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">
            Останні події
          </h2>
          <ul className="mt-3 space-y-2">
            {timeline.map((item) => (
              <li
                key={item}
                className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700"
              >
                {item}
              </li>
            ))}
          </ul>
        </article>
      </section>
    </div>
  );
}
