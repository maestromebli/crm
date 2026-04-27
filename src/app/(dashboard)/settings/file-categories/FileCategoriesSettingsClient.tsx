"use client";

import { SettingsCard } from "../../../../components/settings/SettingsCard";
import { SettingsSavePanel } from "../../../../components/settings/SettingsSavePanel";
import { useRegistrySettings } from "../../../../components/settings/useRegistrySettings";

type FileCategory = { key: string; label: string };
type FileCategoriesSettings = {
  categories: FileCategory[];
  draftName: string;
  draftKey: string;
};

const FALLBACK: FileCategoriesSettings = {
  categories: [
    { key: "measurement_sheet", label: "Лист заміру" },
    { key: "proposal_pdf", label: "Комерційна пропозиція" },
    { key: "contract", label: "Договір" },
    { key: "payment_proof", label: "Підтвердження оплати" },
    { key: "drawing", label: "Креслення / ескіз" },
    { key: "installation_scheme", label: "Схема монтажу" },
  ],
  draftName: "",
  draftKey: "",
};

export function FileCategoriesSettingsClient() {
  const { data, setData, error, saving, savedAt, save } =
    useRegistrySettings<FileCategoriesSettings>("file-categories", FALLBACK);

  return (
    <>
      <SettingsCard
        title="Категорії"
        description="Поточний довідник категорій файлів."
      >
        <ul className="space-y-1 text-[11px] text-slate-700">
          {data.categories.map((item) => (
            <li key={`${item.key}-${item.label}`}>
              {item.key} — {item.label}
            </li>
          ))}
        </ul>
      </SettingsCard>

      <SettingsCard
        title="Створити категорію"
        description="Чернетка нової категорії (назва + ключ)."
      >
        <div className="space-y-1.5">
          <label className="text-[11px] text-slate-600">Назва категорії</label>
          <input
            value={data.draftName}
            onChange={(e) =>
              setData((prev) => ({ ...prev, draftName: e.target.value }))
            }
            className="w-full rounded-md border border-slate-200 bg-[var(--enver-card)] px-2 py-1 text-xs outline-none focus:border-slate-900"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-[11px] text-slate-600">Ключ</label>
          <input
            value={data.draftKey}
            onChange={(e) =>
              setData((prev) => ({ ...prev, draftKey: e.target.value }))
            }
            className="w-full rounded-md border border-slate-200 bg-[var(--enver-card)] px-2 py-1 text-xs outline-none focus:border-slate-900"
          />
        </div>
      </SettingsCard>

      <SettingsSavePanel
        saving={saving}
        savedAt={savedAt}
        error={error}
        onSave={() => void save()}
      />
    </>
  );
}
