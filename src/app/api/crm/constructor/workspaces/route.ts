import { NextResponse } from "next/server";
import { getOrCreateRequestId, jsonError, jsonSuccess } from "@/lib/api/http";
import { requireSessionUser } from "@/lib/authz/api-guard";
import { createConstructorWorkspace } from "@/features/constructor-hub/server/constructor-workspace.service";
import { constructorRoleLabel } from "@/features/constructor-hub/server/constructor-rbac";

export async function POST(request: Request) {
  const requestId = getOrCreateRequestId(request);
  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;

  const role = constructorRoleLabel(user);
  if (!["ADMIN", "DIRECTOR", "HEAD_OF_PRODUCTION", "PRODUCTION_MANAGER"].includes(role)) {
    return jsonError(requestId, "Недостаточно прав", 403);
  }

  try {
    const payload = await request.json();
    const workspace = await createConstructorWorkspace({
      actorUserId: user.id,
      payload,
    });
    return jsonSuccess(requestId, { data: workspace });
  } catch (e) {
    return jsonError(requestId, e instanceof Error ? e.message : "Ошибка создания workspace", 400);
  }
}
