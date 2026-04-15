import { InstallationPlanCard, type InstallationPlan } from "./InstallationPlanCard";
import { InstallationChecklist } from "./InstallationChecklist";
import { InstallationResultPanel } from "./InstallationResultPanel";

export function InstallationBoardPage({ plans }: { plans: InstallationPlan[] }) {
  const checklist = [
    { id: "items-ready", label: "Всі вироби готові", done: true },
    { id: "packed", label: "Упаковано", done: true },
    { id: "loaded", label: "Завантажено", done: false },
    { id: "client", label: "Клієнт підтвердив", done: true },
    { id: "address", label: "Адреса підтверджена", done: true },
    { id: "contact", label: "Контакт підтверджено", done: true },
    { id: "special", label: "Спецумови зафіксовані", done: false },
  ];

  return (
    <div className="space-y-4">
      <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Installation Board</h1>
        <div className="mt-3 flex flex-wrap gap-2">
          <button className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white">Запланувати монтаж</button>
        </div>
      </header>
      <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        <section className="space-y-2">
          {plans.map((plan) => (
            <InstallationPlanCard key={plan.id} plan={plan} />
          ))}
        </section>
        <div className="space-y-4">
          <InstallationChecklist items={checklist} />
          <InstallationResultPanel remarks="" photosCount={0} />
        </div>
      </div>
    </div>
  );
}
