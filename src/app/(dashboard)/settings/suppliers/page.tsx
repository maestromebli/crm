import type { Metadata } from "next";
import { SettingsShell } from "../../../../components/settings/SettingsShell";
import { SupplierSyncPanel } from "../../../../features/suppliers/ui/SupplierSyncPanel";
import { hasEffectivePermission, P } from "../../../../lib/authz/permissions";
import { requirePermissionForPage } from "../../../../lib/authz/page-auth";

export const metadata: Metadata = {
  title: "Постачальники · ENVER CRM",
};

export default async function SettingsSuppliersPage() {
  const session = await requirePermissionForPage(P.SETTINGS_VIEW);
  const canManage = hasEffectivePermission(
    session.user.permissionKeys,
    P.SETTINGS_MANAGE,
    {
      realRole: session.user.realRole,
      impersonatorId: session.user.impersonatorId,
    },
  );

  return (
    <SettingsShell
      title="Постачальники та синхронізація цін"
      description="Завантаження прайсів (CSV/XLSX), контроль останнього оновлення, зміни цін і статус джерел."
    >
      <SupplierSyncPanel canManage={canManage} defaultProviderKey="viyar" />
    </SettingsShell>
  );
}
