import type { Metadata } from "next";
import { SettingsShell } from "../../../components/settings/SettingsShell";
import { GeneralSettingsClient } from "./GeneralSettingsClient";

export const metadata: Metadata = {
  title: "Налаштування · ENVER CRM",
};

export default function SettingsPage() {
  return (
    <SettingsShell
      title="Загальні налаштування"
      description="Базові параметри компанії та CRM: назва, часовий пояс, робочі години, валюта."
    >
      <GeneralSettingsClient />
    </SettingsShell>
  );
}

