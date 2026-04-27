import type { Metadata } from "next";
import { SettingsShell } from "../../../../components/settings/SettingsShell";
import { FileCategoriesSettingsClient } from "./FileCategoriesSettingsClient";

export const metadata: Metadata = {
  title: "Категорії файлів · ENVER CRM",
};

export default function SettingsFileCategoriesPage() {
  return (
    <SettingsShell
      title="Категорії файлів"
      description="Налаштуйте типи файлів, які використовуються у воронках, handoff та виробництві."
    >
      <FileCategoriesSettingsClient />
    </SettingsShell>
  );
}

