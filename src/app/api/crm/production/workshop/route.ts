import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/authz/api-guard";
import { canManageProduction, canViewProduction } from "@/features/production/server/permissions/production-permissions";
import { getProductionCommandCenterView } from "@/features/production/server/services/production-command-center.service";

export async function GET() {
  try {
    const user = await requireSessionUser();
    if (user instanceof NextResponse) return user;
    if (!canViewProduction(user)) {
      return NextResponse.json({ error: "Недостатньо прав" }, { status: 403 });
    }
    const data = await getProductionCommandCenterView();
    const canManage = canManageProduction(user);
    return NextResponse.json({
      workshopKanban: data.workshopKanban,
      canManageWorkshop: canManage,
      /** Відмітки в чеклісті (без зміни структури) — оператори цеху з доступом до перегляду виробництва */
      canMarkWorkshopMaterialsProgress: canViewProduction(user),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Помилка сервера";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
