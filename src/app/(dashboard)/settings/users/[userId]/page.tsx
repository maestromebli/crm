import type { Metadata } from "next";
import { SettingsShell } from "../../../../../components/settings/SettingsShell";
import { UserSettingsDetailClient } from "../../../../../components/settings/UserSettingsDetailClient";
import { requirePermissionForPage, P } from "../../../../../lib/authz/page-auth";

type PageProps = { params: Promise<{ userId: string }> };

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { userId } = await params;
  return {
    title: `Користувач · ENVER CRM`,
    description: `Налаштування користувача ${userId}`,
  };
}

export default async function SettingsUserDetailPage({ params }: PageProps) {
  await requirePermissionForPage(P.USERS_VIEW);
  const { userId } = await params;

  return (
    <SettingsShell
      title="Користувач"
      description="Загальні дані, доступ до пунктів меню та додаткові параметри."
    >
      <UserSettingsDetailClient userId={userId} />
    </SettingsShell>
  );
}
