import type { Metadata } from "next";
import { SettingsShell } from "../../../../components/settings/SettingsShell";
import { SettingsCard } from "../../../../components/settings/SettingsCard";

export const metadata: Metadata = {
  title: "Календар · налаштування · ENVER CRM",
};

export default function SettingsCalendarPage() {
  return (
    <SettingsShell
      title="Календар і слоти"
      description="Робочі години, типи подій, буфери, blackouts та логіка призначення ресурсів."
    >
      <SettingsCard
        title="Робочий тиждень"
        description="Години за замовчуванням для замірів і монтажів."
      >
        <div className="grid gap-2 md:grid-cols-2">
          <label className="space-y-1 text-[11px] text-slate-600">
            Початок дня
            <input
              type="time"
              defaultValue="09:00"
              className="w-full rounded-md border border-slate-200 bg-[var(--enver-card)] px-2 py-1 text-xs"
            />
          </label>
          <label className="space-y-1 text-[11px] text-slate-600">
            Кінець дня
            <input
              type="time"
              defaultValue="18:00"
              className="w-full rounded-md border border-slate-200 bg-[var(--enver-card)] px-2 py-1 text-xs"
            />
          </label>
        </div>
      </SettingsCard>
      <SettingsCard
        title="Тривалість за типом"
        description="Дефолтні хвилини для measurement / meeting / installation."
      >
        <p className="text-[11px] text-slate-600">
          Наступний крок: збереження в БД та застосування в CalendarShell при
          створенні події.
        </p>
      </SettingsCard>
    </SettingsShell>
  );
}
