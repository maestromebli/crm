import type { Metadata } from "next";
import { SettingsShell } from "../../../../components/settings/SettingsShell";
import { SettingsCard } from "../../../../components/settings/SettingsCard";

export const metadata: Metadata = {
  title: "Категорії файлів · ENVER CRM",
};

export default function SettingsFileCategoriesPage() {
  return (
    <SettingsShell
      title="Категорії файлів"
      description="Налаштуйте типи файлів, які використовуються у воронках, handoff та виробництві."
    >
      <SettingsCard
        title="Категорії"
        description="Приклади категорій файлів для процесу ENVER."
      >
        <ul className="space-y-1 text-[11px] text-slate-700">
          <li>measurement_sheet — Лист заміру</li>
          <li>proposal_pdf — Комерційна пропозиція</li>
          <li>contract — Договір</li>
          <li>payment_proof — Підтвердження оплати</li>
          <li>drawing — Креслення / ескіз</li>
          <li>installation_scheme — Схема монтажу</li>
        </ul>
      </SettingsCard>

      <SettingsCard
        title="Створити категорію"
        description="Додайте власну категорію файлів."
      >
        <div className="space-y-1.5">
          <label className="text-[11px] text-slate-600">
            Назва категорії
          </label>
          <input className="w-full rounded-md border border-slate-200 bg-[var(--enver-card)] px-2 py-1 text-xs outline-none focus:border-slate-900" />
        </div>
        <div className="space-y-1.5">
          <label className="text-[11px] text-slate-600">
            Ключ
          </label>
          <input className="w-full rounded-md border border-slate-200 bg-[var(--enver-card)] px-2 py-1 text-xs outline-none focus:border-slate-900" />
        </div>
      </SettingsCard>
    </SettingsShell>
  );
}

