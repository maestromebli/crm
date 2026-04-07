import type { Metadata } from "next";
import { LibraryMaterialsPricesClient } from "../../../../components/library/LibraryMaterialsPricesClient";
import {
  hasEffectivePermission,
  P,
} from "../../../../lib/authz/permissions";
import { requirePermissionForPage } from "../../../../lib/authz/page-auth";

export const metadata: Metadata = {
  title: "Прайси матеріалів · Бібліотека · ENVER CRM",
};

export default async function LibraryMaterialsPage() {
  const session = await requirePermissionForPage(P.REPORTS_VIEW);
  const canManage = hasEffectivePermission(
    session.user.permissionKeys,
    P.SETTINGS_MANAGE,
    {
      realRole: session.user.realRole,
      impersonatorId: session.user.impersonatorId,
    },
  );

  return <LibraryMaterialsPricesClient canManage={canManage} />;
}
