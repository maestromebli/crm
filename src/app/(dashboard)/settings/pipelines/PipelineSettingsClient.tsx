"use client";

import { SettingsCard } from "../../../../components/settings/SettingsCard";
import { SettingsSavePanel } from "../../../../components/settings/SettingsSavePanel";
import { useRegistrySettings } from "../../../../components/settings/useRegistrySettings";

type PipelineSettings = {
  salesStages: string[];
  draftPipelineName: string;
  draftEntityType: "deals" | "production" | "handoff";
};

const FALLBACK: PipelineSettings = {
  salesStages: [
    "Новий лід",
    "Кваліфікація",
    "КП надіслано",
    "Переговори",
    "Договір / передоплата",
    "Передача → виробництво",
    "Монтаж",
    "Закрито / успішно",
  ],
  draftPipelineName: "",
  draftEntityType: "deals",
};

export function PipelineSettingsClient() {
  const { data, setData, error, saving, savedAt, save } =
    useRegistrySettings<PipelineSettings>("pipelines", FALLBACK);

  return (
    <>
      <SettingsCard
        title="Воронка продажів"
        description="Канонічні стадії продажів для замовлень."
      >
        <ol className="list-decimal space-y-0.5 pl-4 text-[11px] text-slate-700">
          {data.salesStages.map((stage, index) => (
            <li key={`${stage}-${index}`}>{stage}</li>
          ))}
        </ol>
      </SettingsCard>

      <SettingsCard
        title="Додати воронку"
        description="Чернетка нової воронки для B2B, сервісних заявок чи партнерських проектів."
      >
        <div className="space-y-1.5">
          <label className="text-[11px] text-slate-600">Назва воронки</label>
          <input
            value={data.draftPipelineName}
            onChange={(e) =>
              setData((prev) => ({ ...prev, draftPipelineName: e.target.value }))
            }
            className="w-full rounded-md border border-slate-200 bg-[var(--enver-card)] px-2 py-1 text-xs outline-none focus:border-slate-900"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-[11px] text-slate-600">Тип сутності</label>
          <select
            value={data.draftEntityType}
            onChange={(e) =>
              setData((prev) => ({
                ...prev,
                draftEntityType: e.target.value as PipelineSettings["draftEntityType"],
              }))
            }
            className="w-full rounded-md border border-slate-200 bg-[var(--enver-card)] px-2 py-1 text-xs outline-none focus:border-slate-900"
          >
            <option value="deals">Замовлення</option>
            <option value="production">Виробництво</option>
            <option value="handoff">Передача</option>
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
