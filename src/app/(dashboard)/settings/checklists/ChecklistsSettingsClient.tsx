"use client";

import { SettingsCard } from "../../../../components/settings/SettingsCard";
import { SettingsSavePanel } from "../../../../components/settings/SettingsSavePanel";
import { useRegistrySettings } from "../../../../components/settings/useRegistrySettings";
import { CHECKLIST_TEMPLATES } from "../../../../config/checklists";

type ChecklistTemplateRow = {
  id: string;
  label: string;
  itemsCount: number;
};

type ChecklistSettings = {
  templates: ChecklistTemplateRow[];
  draftName: string;
  draftScope: "Передача" | "Стадія" | "Монтаж";
};

const FALLBACK: ChecklistSettings = {
  templates: CHECKLIST_TEMPLATES.map((tpl) => ({
    id: tpl.id,
    label: tpl.label,
    itemsCount: tpl.items.length,
  })),
  draftName: "",
  draftScope: "Передача",
};

export function ChecklistsSettingsClient() {
  const { data, setData, error, saving, savedAt, save } =
    useRegistrySettings<ChecklistSettings>("checklists", FALLBACK);

  return (
    <>
      <SettingsCard
        title="Існуючі шаблони"
        description="Поточні шаблони, що використовуються при переході стадій."
      >
        <ul className="space-y-1 text-[11px] text-slate-700">
          {data.templates.map((tpl) => (
            <li key={tpl.id}>
              <span className="font-medium">{tpl.label}</span>{" "}
              <span className="text-slate-500">· {tpl.itemsCount} пунктів</span>
            </li>
          ))}
        </ul>
      </SettingsCard>

      <SettingsCard
        title="Створити шаблон"
        description="Чернетка нового шаблону чек-листа."
      >
        <div className="space-y-1.5">
          <label className="text-[11px] text-slate-600">Назва шаблону</label>
          <input
            value={data.draftName}
            onChange={(e) =>
              setData((prev) => ({ ...prev, draftName: e.target.value }))
            }
            className="w-full rounded-md border border-slate-200 bg-[var(--enver-card)] px-2 py-1 text-xs outline-none focus:border-slate-900"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-[11px] text-slate-600">Застосовується до</label>
          <select
            value={data.draftScope}
            onChange={(e) =>
              setData((prev) => ({
                ...prev,
                draftScope: e.target.value as ChecklistSettings["draftScope"],
              }))
            }
            className="w-full rounded-md border border-slate-200 bg-[var(--enver-card)] px-2 py-1 text-xs outline-none focus:border-slate-900"
          >
            <option>Передача</option>
            <option>Стадія</option>
            <option>Монтаж</option>
          </select>
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
