import type { Metadata } from "next";
import { SettingsShell } from "../../../../components/settings/SettingsShell";
import { CalendarSettingsClient } from "./CalendarSettingsClient";

export const metadata: Metadata = {
  title: "Календар · налаштування · ENVER CRM",
};

export default function SettingsCalendarPage() {
  return (
    <SettingsShell
      title="Календар і слоти"
      description="Робочі години, типи подій, буфери, blackouts та логіка призначення ресурсів."
    >
      <CalendarSettingsClient />
    </SettingsShell>
  );
}
