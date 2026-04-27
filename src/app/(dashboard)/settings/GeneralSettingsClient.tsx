"use client";

import { SettingsSavePanel } from "../../../components/settings/SettingsSavePanel";
import { useRegistrySettings } from "../../../components/settings/useRegistrySettings";

type GeneralSettings = {
  companyName: string;
  contactEmail: string;
  timezone: string;
  currency: "USD" | "EUR" | "UAH";
};

const FALLBACK: GeneralSettings = {
  companyName: "",
  contactEmail: "",
  timezone: "Europe/Kyiv",
  currency: "USD",
};

export function GeneralSettingsClient() {
  const { data, setData, error, saving, savedAt, save } =
    useRegistrySettings<GeneralSettings>("general", FALLBACK);

  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50/80 px-3 py-3 text-xs">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Організація
          </p>
          <div className="space-y-1.5">
            <label className="text-[11px] text-slate-600">Назва компанії</label>
            <input
              value={data.companyName}
              onChange={(e) =>
                setData((prev) => ({ ...prev, companyName: e.target.value }))
              }
              className="w-full rounded-md border border-slate-200 bg-[var(--enver-card)] px-2 py-1 text-xs outline-none focus:border-slate-900"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] text-slate-600">Контактна е-пошта</label>
            <input
              type="email"
              value={data.contactEmail}
              onChange={(e) =>
                setData((prev) => ({ ...prev, contactEmail: e.target.value }))
              }
              className="w-full rounded-md border border-slate-200 bg-[var(--enver-card)] px-2 py-1 text-xs outline-none focus:border-slate-900"
            />
          </div>
        </div>

        <div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50/80 px-3 py-3 text-xs">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Час та валюта
          </p>
          <div className="space-y-1.5">
            <label className="text-[11px] text-slate-600">Часовий пояс</label>
            <select
              value={data.timezone}
              onChange={(e) =>
                setData((prev) => ({ ...prev, timezone: e.target.value }))
              }
              className="w-full rounded-md border border-slate-200 bg-[var(--enver-card)] px-2 py-1 text-xs outline-none focus:border-slate-900"
            >
              <option value="Europe/Kyiv">Europe/Kyiv (GMT+2)</option>
              <option value="Europe/Warsaw">Europe/Warsaw (GMT+1)</option>
              <option value="UTC">UTC</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] text-slate-600">
              Валюта за замовчуванням
            </label>
            <select
              value={data.currency}
              onChange={(e) =>
                setData((prev) => ({
                  ...prev,
                  currency: e.target.value as GeneralSettings["currency"],
                }))
              }
              className="w-full rounded-md border border-slate-200 bg-[var(--enver-card)] px-2 py-1 text-xs outline-none focus:border-slate-900"
            >
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="UAH">UAH</option>
            </select>
          </div>
        </div>
      </div>
      <div className="rounded-2xl border border-sky-200 bg-sky-50/60 px-3 py-3 text-xs text-sky-950">
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
      <SettingsSavePanel
        saving={saving}
        savedAt={savedAt}
        error={error}
        onSave={() => void save()}
      />
    </div>
  );
}
