import { jsonError, jsonSuccess } from "@/lib/api/http";
import { canSubmitConstructorVersion } from "@/features/constructor-hub/server/constructor-rbac";
import { requireWorkspaceViewScope } from "@/features/constructor-hub/server/constructor-api-helpers";
import { createConstructorVersion } from "@/features/constructor-hub/server/constructor-version.service";

type Ctx = { params: Promise<{ workspaceId: string }> };

export async function POST(request: Request, context: Ctx) {
  const { workspaceId } = await context.params;
  const scoped = await requireWorkspaceViewScope({ request, workspaceId });
  if ("errorResponse" in scoped) return scoped.errorResponse;

  if (!canSubmitConstructorVersion(scoped.user, scoped.workspace)) {
    return jsonError(scoped.requestId, "Недостаточно прав на создание версии", 403);
  }
  try {
    const payload = await request.json();
    const data = await createConstructorVersion({
      workspaceId,
      actorUserId: scoped.user.id,
      payload,
    });
    return jsonSuccess(scoped.requestId, { data });
  } catch (e) {
    return jsonError(scoped.requestId, e instanceof Error ? e.message : "Ошибка создания версии", 400);
  }
}
