"use client";

import { SettingsCard } from "../../../../components/settings/SettingsCard";

export function CalendarSettingsClient() {
  return (
    <SettingsCard
      title="Робочі слоти"
      description="Календарні правила синхронізуються з CRM-календарем і задачами."
    >
      <p className="text-[11px] text-slate-600">
        Розділ доступний для переходів. Детальні параметри слотів, буферів і blackout-періодів вже обробляються в календарному модулі та будуть зведені в цей екран.
      </p>
    </SettingsCard>
  );
}
