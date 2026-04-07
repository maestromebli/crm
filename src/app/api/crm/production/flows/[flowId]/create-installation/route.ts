import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/authz/api-guard";
import { canManageProduction } from "@/features/production/server/permissions/production-permissions";
import { createInstallationTasksFromWorkshop } from "@/features/production/server/services/production-distribution.service";

type Ctx = { params: Promise<{ flowId: string }> };

export async function POST(_request: Request, context: Ctx) {
  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;
  if (!canManageProduction(user)) {
    return NextResponse.json({ error: "Недостатньо прав" }, { status: 403 });
  }

  const { flowId } = await context.params;
  try {
    await createInstallationTasksFromWorkshop(flowId, user.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Помилка створення монтажних задач";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
