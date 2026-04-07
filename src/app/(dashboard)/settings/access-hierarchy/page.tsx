import type { Metadata } from "next";
import { SettingsShell } from "../../../../components/settings/SettingsShell";
import { P, requirePermissionForPage } from "../../../../lib/authz/page-auth";
import { AccessHierarchyManager } from "./AccessHierarchyManager";

export const metadata: Metadata = {
  title: "Ієрархія доступу · ENVER CRM",
};

export default async function SettingsAccessHierarchyPage() {
  await requirePermissionForPage(P.USERS_MANAGE);
  return (
    <SettingsShell
      title="Ієрархія головних менеджерів"
      description="Призначення менеджерів продажу конкретним головним менеджерам для коректного scope доступу."
    >
      <AccessHierarchyManager />
    </SettingsShell>
  );
}
