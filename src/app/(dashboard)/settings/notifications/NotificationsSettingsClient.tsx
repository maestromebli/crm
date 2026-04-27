"use client";

import { SettingsCard } from "../../../../components/settings/SettingsCard";
import { SettingsSavePanel } from "../../../../components/settings/SettingsSavePanel";
import { useRegistrySettings } from "../../../../components/settings/useRegistrySettings";

type NotificationsSettings = {
  categories: string[];
  ruleCategory: string;
  deliveryChannel: "У застосунку" | "Ел. пошта";
};

const FALLBACK: NotificationsSettings = {
  categories: ["Призначення", "SLA", "Зміна стадії", "Передача"],
  ruleCategory: "Призначення",
  deliveryChannel: "У застосунку",
};

export function NotificationsSettingsClient() {
  const { data, setData, error, saving, savedAt, save } =
    useRegistrySettings<NotificationsSettings>("notifications", FALLBACK);

  return (
    <>
      <SettingsCard
        title="Ключові сповіщення"
        description="Поточний перелік груп сповіщень."
      >
        <ul className="space-y-1 text-[11px] text-slate-700">
          {data.categories.map((category) => (
            <li key={category}>{category}</li>
          ))}
        </ul>
      </SettingsCard>

      <SettingsCard
        title="Налаштування правила"
        description="Чернетка правила: категорія та канал доставки."
      >
        <div className="space-y-1.5">
          <label className="text-[11px] text-slate-600">Категорія</label>
          <select
            value={data.ruleCategory}
            onChange={(e) =>
              setData((prev) => ({ ...prev, ruleCategory: e.target.value }))
            }
            className="w-full rounded-md border border-slate-200 bg-[var(--enver-card)] px-2 py-1 text-xs outline-none focus:border-slate-900"
          >
            <option>Призначення</option>
            <option>SLA</option>
            <option>Вхідні</option>
            <option>Задачі</option>
            <option>Стадія</option>
            <option>Передача</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="text-[11px] text-slate-600">Канал доставки</label>
          <select
            value={data.deliveryChannel}
            onChange={(e) =>
              setData((prev) => ({
                ...prev,
                deliveryChannel: e.target.value as NotificationsSettings["deliveryChannel"],
              }))
            }
            className="w-full rounded-md border border-slate-200 bg-[var(--enver-card)] px-2 py-1 text-xs outline-none focus:border-slate-900"
          >
            <option>У застосунку</option>
            <option>Ел. пошта</option>
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
