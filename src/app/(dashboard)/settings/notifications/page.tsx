import type { Metadata } from "next";
import { SettingsShell } from "../../../../components/settings/SettingsShell";
import { SettingsCard } from "../../../../components/settings/SettingsCard";

export const metadata: Metadata = {
  title: "Правила сповіщень · ENVER CRM",
};

export default function SettingsNotificationsPage() {
  return (
    <SettingsShell
      title="Правила сповіщень"
      description="Налаштуйте, які події створюють сповіщення для команди."
    >
      <SettingsCard
        title="Ключові сповіщення"
        description="Приклади груп сповіщень для ENVER."
      >
        <ul className="space-y-1 text-[11px] text-slate-700">
          <li>
            Призначення — новий лід або угода призначені користувачу.
          </li>
          <li>
            SLA — прострочений час відповіді у вхідних.
          </li>
          <li>
            Зміна стадії — угода перейшла на нову стадію.
          </li>
          <li>
            Передача — нова передача у виробництво, готова до прийняття.
          </li>
        </ul>
      </SettingsCard>

      <SettingsCard
        title="Налаштування правила"
        description="Оберіть категорію, канал доставки та цільову роль."
      >
        <div className="space-y-1.5">
          <label className="text-[11px] text-slate-600">
            Категорія
          </label>
          <select className="w-full rounded-md border border-slate-200 bg-[var(--enver-card)] px-2 py-1 text-xs outline-none focus:border-slate-900">
            <option>Призначення</option>
            <option>SLA</option>
            <option>Вхідні</option>
            <option>Задачі</option>
            <option>Стадія</option>
            <option>Передача</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="text-[11px] text-slate-600">
            Канал доставки
          </label>
          <select className="w-full rounded-md border border-slate-200 bg-[var(--enver-card)] px-2 py-1 text-xs outline-none focus:border-slate-900">
            <option>У застосунку</option>
            <option>Ел. пошта</option>
          </select>
        </div>
      </SettingsCard>
    </SettingsShell>
  );
}
