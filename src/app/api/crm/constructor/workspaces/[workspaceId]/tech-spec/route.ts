import { jsonError, jsonSuccess } from "@/lib/api/http";
import { canEditConstructorTechSpec } from "@/features/constructor-hub/server/constructor-rbac";
import { requireWorkspaceViewScope } from "@/features/constructor-hub/server/constructor-api-helpers";
import { updateConstructorTechSpec } from "@/features/constructor-hub/server/constructor-workspace.service";

type Ctx = { params: Promise<{ workspaceId: string }> };

export async function PATCH(request: Request, context: Ctx) {
  const { workspaceId } = await context.params;
  const scoped = await requireWorkspaceViewScope({ request, workspaceId });
  if ("errorResponse" in scoped) return scoped.errorResponse;

  if (!canEditConstructorTechSpec(scoped.user, scoped.workspace)) {
    return jsonError(scoped.requestId, "Недостаточно прав на редактирование ТЗ", 403);
  }
  try {
    const payload = await request.json();
    await updateConstructorTechSpec({
      workspaceId,
      actorUserId: scoped.user.id,
      payload,
    });
    return jsonSuccess(scoped.requestId, { data: { workspaceId } });
  } catch (e) {
    return jsonError(scoped.requestId, e instanceof Error ? e.message : "Ошибка обновления ТЗ", 400);
  }
}
