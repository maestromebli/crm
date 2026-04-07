import type { Metadata } from "next";
import { SettingsShell } from "../../../../components/settings/SettingsShell";
import { SettingsCard } from "../../../../components/settings/SettingsCard";
import { CHECKLIST_TEMPLATES } from "../../../../config/checklists";

export const metadata: Metadata = {
  title: "Шаблони чек-листів · ENVER CRM",
};

export default function SettingsChecklistsPage() {
  return (
    <SettingsShell
      title="Шаблони чек-листів"
      description="Створюйте чек-листи для handoff, монтажів та етапів воронки."
    >
      <SettingsCard
        title="Існуючі шаблони"
        description="Поточні шаблони, що використовуються при переході стадій."
      >
        <ul className="space-y-1 text-[11px] text-slate-700">
          {CHECKLIST_TEMPLATES.map((tpl) => (
            <li key={tpl.id}>
              <span className="font-medium">{tpl.label}</span>{" "}
              <span className="text-slate-500">
                · {tpl.items.length} пунктів
              </span>
            </li>
          ))}
        </ul>
      </SettingsCard>

      <SettingsCard
        title="Створити шаблон"
        description="Задайте назву, тип та пункти чек-листа."
      >
        <div className="space-y-1.5">
          <label className="text-[11px] text-slate-600">
            Назва шаблону
          </label>
          <input className="w-full rounded-md border border-slate-200 bg-[var(--enver-card)] px-2 py-1 text-xs outline-none focus:border-slate-900" />
        </div>
        <div className="space-y-1.5">
          <label className="text-[11px] text-slate-600">
            Застосовується до
          </label>
          <select className="w-full rounded-md border border-slate-200 bg-[var(--enver-card)] px-2 py-1 text-xs outline-none focus:border-slate-900">
            <option>Handoff</option>
            <option>Stage</option>
            <option>Installation</option>
          </select>
        </div>
      </SettingsCard>
    </SettingsShell>
  );
}

