import type { Metadata } from "next";
import { SettingsShell } from "../../../../components/settings/SettingsShell";
import { SettingsCard } from "../../../../components/settings/SettingsCard";

export const metadata: Metadata = {
  title: "Брендинг / UI · ENVER CRM",
};

export default function SettingsBrandingPage() {
  return (
    <SettingsShell
      title="Брендинг / UI"
      description="Логотип, кольори теми, щільність інтерфейсу та термінологія."
    >
      <SettingsCard
        title="Робочий простір"
        description="Назва та логотип у шапці."
      >
        <label className="space-y-1 text-[11px] text-slate-600">
          Назва в інтерфейсі
          <input
            placeholder="ENVER CRM"
            className="w-full rounded-md border border-slate-200 bg-[var(--enver-card)] px-2 py-1 text-xs outline-none focus:border-slate-900"
          />
        </label>
      </SettingsCard>
      <SettingsCard
        title="Щільність"
        description="Компактний або комфортний режим списків."
      >
        <select className="w-full rounded-md border border-slate-200 bg-[var(--enver-card)] px-2 py-1 text-xs outline-none focus:border-slate-900">
          <option>Компактно (операційний)</option>
          <option>Комфортно</option>
        </select>
      </SettingsCard>
    </SettingsShell>
  );
}
