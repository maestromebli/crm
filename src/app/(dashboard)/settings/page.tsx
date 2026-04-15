import type { Metadata } from "next";
import { SettingsShell } from "../../../components/settings/SettingsShell";

export const metadata: Metadata = {
  title: "Налаштування · ENVER CRM",
};

export default function SettingsPage() {
  return (
    <SettingsShell
      title="Загальні налаштування"
      description="Базові параметри компанії та CRM: назва, часовий пояс, робочі години, валюта."
    >
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50/80 px-3 py-3 text-xs">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Організація
          </p>
          <div className="space-y-1.5">
            <label className="text-[11px] text-slate-600">
              Назва компанії
            </label>
            <input className="w-full rounded-md border border-slate-200 bg-[var(--enver-card)] px-2 py-1 text-xs outline-none focus:border-slate-900" />
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] text-slate-600">
              Контактна е-пошта
            </label>
            <input className="w-full rounded-md border border-slate-200 bg-[var(--enver-card)] px-2 py-1 text-xs outline-none focus:border-slate-900" />
          </div>
        </div>

        <div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50/80 px-3 py-3 text-xs">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Час та валюта
          </p>
          <div className="space-y-1.5">
            <label className="text-[11px] text-slate-600">
              Часовий пояс
            </label>
            <select className="w-full rounded-md border border-slate-200 bg-[var(--enver-card)] px-2 py-1 text-xs outline-none focus:border-slate-900">
              <option>Europe/Kyiv (GMT+2)</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] text-slate-600">
              Валюта за замовчуванням
            </label>
            <select className="w-full rounded-md border border-slate-200 bg-[var(--enver-card)] px-2 py-1 text-xs outline-none focus:border-slate-900">
              <option>USD</option>
              <option>EUR</option>
              <option>UAH</option>
            </select>
          </div>
        </div>
      </div>
      <div className="mt-3 rounded-2xl border border-sky-200 bg-sky-50/60 px-3 py-3 text-xs text-sky-950">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-700">
          Матеріали
        </p>
        <p className="mt-1">
          Для створення/оновлення бази матеріалів перейдіть у{" "}
          <a href="/settings/materials" className="font-semibold underline underline-offset-2">
            Налаштування → База матеріалів
          </a>{" "}
          та завантажте Excel-прайс.
        </p>
      </div>
    </SettingsShell>
  );
}

