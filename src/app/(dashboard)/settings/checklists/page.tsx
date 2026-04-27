import type { Metadata } from "next";
import { SettingsShell } from "../../../../components/settings/SettingsShell";
import { ChecklistsSettingsClient } from "./ChecklistsSettingsClient";

export const metadata: Metadata = {
  title: "Шаблони чек-листів · ENVER CRM",
};

export default function SettingsChecklistsPage() {
  return (
    <SettingsShell
      title="Шаблони чек-листів"
      description="Створюйте чек-листи для передачі у виробництво, монтажів та етапів воронки."
    >
      <ChecklistsSettingsClient />
    </SettingsShell>
  );
}

