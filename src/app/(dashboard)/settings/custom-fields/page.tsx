import type { Metadata } from "next";
import { SettingsShell } from "../../../../components/settings/SettingsShell";
import { SettingsCard } from "../../../../components/settings/SettingsCard";

export const metadata: Metadata = {
  title: "Кастомні поля · ENVER CRM",
};

export default function SettingsCustomFieldsPage() {
  return (
    <SettingsShell
      title="Кастомні поля"
      description="Додайте власні поля для лідів, контактів, угод та передачі у виробництво."
    >
      <SettingsCard
        title="Поля за сутністю"
        description="Приклад структури полів для різних сутностей."
      >
        <table className="w-full border-collapse text-[11px]">
          <thead>
            <tr className="border-b border-slate-200 text-slate-500">
              <th className="py-1 text-left">Сутність</th>
              <th className="py-1 text-left">Поле</th>
              <th className="py-1 text-left">Тип</th>
              <th className="py-1 text-left">Обовʼязкове</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-slate-100">
              <td className="py-1">Лід</td>
              <td className="py-1">Джерело</td>
              <td className="py-1">список</td>
              <td className="py-1">так</td>
            </tr>
            <tr className="border-b border-slate-100">
              <td className="py-1">Угода</td>
              <td className="py-1">Тип обʼєкта</td>
              <td className="py-1">список</td>
              <td className="py-1">ні</td>
            </tr>
          </tbody>
        </table>
      </SettingsCard>

      <SettingsCard
        title="Створити поле"
        description="Вкажіть сутність, назву, тип та обовʼязковість."
      >
        <div className="space-y-1.5">
          <label className="text-[11px] text-slate-600">
            Сутність
          </label>
          <select className="w-full rounded-md border border-slate-200 bg-[var(--enver-card)] px-2 py-1 text-xs outline-none focus:border-slate-900">
            <option>Лід</option>
            <option>Контакт</option>
            <option>Угода</option>
            <option>Передача у виробництво</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="text-[11px] text-slate-600">
            Назва поля
          </label>
          <input className="w-full rounded-md border border-slate-200 bg-[var(--enver-card)] px-2 py-1 text-xs outline-none focus:border-slate-900" />
        </div>
        <div className="space-y-1.5">
          <label className="text-[11px] text-slate-600">
            Тип
          </label>
          <select className="w-full rounded-md border border-slate-200 bg-[var(--enver-card)] px-2 py-1 text-xs outline-none focus:border-slate-900">
            <option>текст</option>
            <option>число</option>
            <option>список</option>
            <option>дата</option>
          </select>
        </div>
      </SettingsCard>
    </SettingsShell>
  );
}

