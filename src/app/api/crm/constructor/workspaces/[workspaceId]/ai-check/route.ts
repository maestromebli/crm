import { jsonError, jsonSuccess } from "@/lib/api/http";
import { canReviewConstructorVersion } from "@/features/constructor-hub/server/constructor-rbac";
import { requireWorkspaceViewScope } from "@/features/constructor-hub/server/constructor-api-helpers";
import { runConstructorWorkspaceAICheck } from "@/features/constructor-hub/server/constructor-ai.service";

type Ctx = { params: Promise<{ workspaceId: string }> };

export async function POST(request: Request, context: Ctx) {
  const { workspaceId } = await context.params;
  const scoped = await requireWorkspaceViewScope({ request, workspaceId });
  if ("errorResponse" in scoped) return scoped.errorResponse;
  if (!canReviewConstructorVersion(scoped.user, scoped.workspace) && scoped.workspace.assignedConstructorUserId !== scoped.user.id) {
    return jsonError(scoped.requestId, "Недостаточно прав на AI check", 403);
  }
  try {
    const data = await runConstructorWorkspaceAICheck(workspaceId);
    return jsonSuccess(scoped.requestId, { data });
  } catch (e) {
    return jsonError(scoped.requestId, e instanceof Error ? e.message : "Ошибка AI check", 400);
  }
}
