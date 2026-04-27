import type { Metadata } from "next";
import { SettingsShell } from "../../../../components/settings/SettingsShell";
import { CustomFieldsSettingsClient } from "./CustomFieldsSettingsClient";

export const metadata: Metadata = {
  title: "Кастомні поля · ENVER CRM",
};

export default function SettingsCustomFieldsPage() {
  return (
    <SettingsShell
      title="Кастомні поля"
      description="Додайте власні поля для лідів, контактів, замовлень та передачі у виробництво."
    >
      <CustomFieldsSettingsClient />
    </SettingsShell>
  );
}

