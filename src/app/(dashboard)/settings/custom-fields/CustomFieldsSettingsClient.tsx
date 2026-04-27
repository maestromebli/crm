"use client";

import { SettingsCard } from "../../../../components/settings/SettingsCard";
import { SettingsSavePanel } from "../../../../components/settings/SettingsSavePanel";
import { useRegistrySettings } from "../../../../components/settings/useRegistrySettings";

type CustomField = {
  entity: string;
  name: string;
  type: string;
  required: boolean;
};

type CustomFieldsSettings = {
  fields: CustomField[];
  draftEntity: string;
  draftName: string;
  draftType: string;
  draftRequired: boolean;
};

const FALLBACK: CustomFieldsSettings = {
  fields: [
    { entity: "Лід", name: "Джерело", type: "список", required: true },
    { entity: "Замовлення", name: "Тип обʼєкта", type: "список", required: false },
  ],
  draftEntity: "Лід",
  draftName: "",
  draftType: "текст",
  draftRequired: false,
};

export function CustomFieldsSettingsClient() {
  const { data, setData, error, saving, savedAt, save } =
    useRegistrySettings<CustomFieldsSettings>("custom-fields", FALLBACK);

  return (
    <>
      <SettingsCard
        title="Поля за сутністю"
        description="Збережені поля для різних сутностей."
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
            {data.fields.map((row, index) => (
              <tr key={`${row.entity}-${row.name}-${index}`} className="border-b border-slate-100">
                <td className="py-1">{row.entity}</td>
                <td className="py-1">{row.name}</td>
                <td className="py-1">{row.type}</td>
                <td className="py-1">{row.required ? "так" : "ні"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </SettingsCard>

      <SettingsCard
        title="Створити поле"
        description="Чернетка нового поля зберігається у налаштуваннях."
      >
        <div className="space-y-1.5">
          <label className="text-[11px] text-slate-600">Сутність</label>
          <select
            value={data.draftEntity}
            onChange={(e) =>
              setData((prev) => ({ ...prev, draftEntity: e.target.value }))
            }
            className="w-full rounded-md border border-slate-200 bg-[var(--enver-card)] px-2 py-1 text-xs outline-none focus:border-slate-900"
          >
            <option>Лід</option>
            <option>Контакт</option>
            <option>Замовлення</option>
            <option>Передача у виробництво</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="text-[11px] text-slate-600">Назва поля</label>
          <input
            value={data.draftName}
            onChange={(e) =>
              setData((prev) => ({ ...prev, draftName: e.target.value }))
            }
            className="w-full rounded-md border border-slate-200 bg-[var(--enver-card)] px-2 py-1 text-xs outline-none focus:border-slate-900"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-[11px] text-slate-600">Тип</label>
          <select
            value={data.draftType}
            onChange={(e) =>
              setData((prev) => ({ ...prev, draftType: e.target.value }))
            }
            className="w-full rounded-md border border-slate-200 bg-[var(--enver-card)] px-2 py-1 text-xs outline-none focus:border-slate-900"
          >
            <option>текст</option>
            <option>число</option>
            <option>список</option>
            <option>дата</option>
          </select>
        </div>
        <label className="flex items-center gap-2 text-[11px] text-slate-600">
          <input
            type="checkbox"
            checked={data.draftRequired}
            onChange={(e) =>
              setData((prev) => ({ ...prev, draftRequired: e.target.checked }))
            }
          />
          Поле обовʼязкове
        </label>
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
