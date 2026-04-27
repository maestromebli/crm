"use client";

import { SettingsCard } from "../../../../components/settings/SettingsCard";

export function BrandingSettingsClient() {
  return (
    <SettingsCard
      title="Брендинг інтерфейсу"
      description="Логотип, палітра та стилі бренду застосовуються централізовано."
    >
      <p className="text-[11px] text-slate-600">
        Сторінка брендингу працює. Керування темами та токенами дизайну винесено в глобальні стилі і буде доступне у візуальному редакторі після синхронізації з дизайн-системою.
      </p>
    </SettingsCard>
  );
}
