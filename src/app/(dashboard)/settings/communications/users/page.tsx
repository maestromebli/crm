import type { Metadata } from "next";
import { SettingsShell } from "../../../../../components/settings/SettingsShell";
import { UsersCommunicationsManager } from "./UsersCommunicationsManager";
import { P, requirePermissionForPage } from "../../../../../lib/authz/page-auth";

export const metadata: Metadata = {
  title: "Підключення співробітників · ENVER CRM",
};

export default async function SettingsUsersCommunicationsPage({
  searchParams,
}: {
  searchParams?: Promise<{ userId?: string }>;
}) {
  await requirePermissionForPage(P.USERS_VIEW);
  const params = await searchParams;
  const initialUserId =
    typeof params?.userId === "string" ? params.userId : undefined;
  return (
    <SettingsShell
      title="Підключення співробітників"
      description="Пряме підключення номера телефону та месенджерів на конкретного співробітника."
    >
      <UsersCommunicationsManager initialUserId={initialUserId} />
    </SettingsShell>
  );
}
