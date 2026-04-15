import { jsonError, jsonSuccess } from "@/lib/api/http";
import { assignConstructor } from "@/features/constructor-hub/server/constructor-workspace.service";
import { constructorRoleLabel } from "@/features/constructor-hub/server/constructor-rbac";
import { requireWorkspaceViewScope } from "@/features/constructor-hub/server/constructor-api-helpers";

type Ctx = { params: Promise<{ workspaceId: string }> };

export async function POST(request: Request, context: Ctx) {
  const { workspaceId } = await context.params;
  const scoped = await requireWorkspaceViewScope({ request, workspaceId });
  if ("errorResponse" in scoped) return scoped.errorResponse;

  const role = constructorRoleLabel(scoped.user);
  if (!["ADMIN", "DIRECTOR", "HEAD_OF_PRODUCTION", "PRODUCTION_MANAGER"].includes(role)) {
    return jsonError(scoped.requestId, "Недостаточно прав на назначение конструктора", 403);
  }

  try {
    const payload = await request.json();
    const data = await assignConstructor({
      workspaceId,
      actorUserId: scoped.user.id,
      payload,
    });
    return jsonSuccess(scoped.requestId, { data });
  } catch (e) {
    return jsonError(scoped.requestId, e instanceof Error ? e.message : "Не удалось назначить конструктора", 400);
  }
}
