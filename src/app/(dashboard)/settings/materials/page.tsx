import type { Metadata } from "next";
import { SettingsShell } from "../../../../components/settings/SettingsShell";
import { SettingsMaterialsCatalogManager } from "../../../../components/settings/SettingsMaterialsCatalogManager";
import { requirePermissionForPage, P } from "../../../../lib/authz/page-auth";

export const metadata: Metadata = {
  title: "База матеріалів · ENVER CRM",
};

export default async function SettingsMaterialsPage() {
  await requirePermissionForPage(P.SETTINGS_VIEW);

  return (
    <SettingsShell
      title="База даних матеріалів"
      description="Завантаження прайсів (Excel), AI/heuristic обробка та оновлення каталогу матеріалів для швидкого прорахунку."
    >
      <SettingsMaterialsCatalogManager />
    </SettingsShell>
  );
}
