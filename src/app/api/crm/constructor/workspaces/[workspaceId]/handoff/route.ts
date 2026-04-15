import { jsonError, jsonSuccess } from "@/lib/api/http";
import { canHandoffConstructorWorkspace } from "@/features/constructor-hub/server/constructor-rbac";
import { requireWorkspaceViewScope } from "@/features/constructor-hub/server/constructor-api-helpers";
import { handoffConstructorWorkspaceToProduction } from "@/features/constructor-hub/server/constructor-workspace.service";
import {
  createProcurementIntakeFromConstructorApproval,
  createProductionIntakeFromConstructorApproval,
} from "@/features/constructor-hub/server/constructor-handoff.service";

type Ctx = { params: Promise<{ workspaceId: string }> };

export async function POST(request: Request, context: Ctx) {
  const { workspaceId } = await context.params;
  const scoped = await requireWorkspaceViewScope({ request, workspaceId });
  if ("errorResponse" in scoped) return scoped.errorResponse;
  if (!canHandoffConstructorWorkspace(scoped.user, scoped.workspace)) {
    return jsonError(scoped.requestId, "Недостаточно прав для handoff", 403);
  }
  try {
    await handoffConstructorWorkspaceToProduction({
      workspaceId,
      actorUserId: scoped.user.id,
    });
    await createProcurementIntakeFromConstructorApproval({
      workspaceId,
      actorUserId: scoped.user.id,
    });
    await createProductionIntakeFromConstructorApproval({
      workspaceId,
      actorUserId: scoped.user.id,
    });
    return jsonSuccess(scoped.requestId, { data: { workspaceId, handedOff: true } });
  } catch (e) {
    return jsonError(scoped.requestId, e instanceof Error ? e.message : "Ошибка handoff", 400);
  }
}
