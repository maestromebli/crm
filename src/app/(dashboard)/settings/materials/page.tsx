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
      <div className="rounded-lg border border-sky-200 bg-sky-50/60 px-3 py-2 text-xs text-sky-900">
        Керуйте джерелами та sync-статусом у{" "}
        <a href="/settings/suppliers" className="font-semibold underline underline-offset-2">
          Налаштування → Постачальники
        </a>
        .
      </div>
    </SettingsShell>
  );
}
