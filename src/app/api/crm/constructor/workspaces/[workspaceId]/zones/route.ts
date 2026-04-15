import { jsonError, jsonSuccess } from "@/lib/api/http";
import { prisma } from "@/lib/prisma";
import { canSubmitConstructorVersion } from "@/features/constructor-hub/server/constructor-rbac";
import { requireWorkspaceViewScope } from "@/features/constructor-hub/server/constructor-api-helpers";
import { constructorZoneProgressSchema } from "@/features/constructor-hub/server/constructor-validation";
import { createConstructorTimelineEvent } from "@/features/constructor-hub/server/constructor-timeline.service";

type Ctx = { params: Promise<{ workspaceId: string }> };

export async function PATCH(request: Request, context: Ctx) {
  const { workspaceId } = await context.params;
  const scoped = await requireWorkspaceViewScope({ request, workspaceId });
  if ("errorResponse" in scoped) return scoped.errorResponse;
  if (!canSubmitConstructorVersion(scoped.user, scoped.workspace)) {
    return jsonError(scoped.requestId, "Недостаточно прав на обновление прогресса зон", 403);
  }
  try {
    const payload = constructorZoneProgressSchema.parse(await request.json());
    const data = await prisma.constructorZoneProgress.upsert({
      where: {
        workspaceId_zoneKey: {
          workspaceId,
          zoneKey: payload.zoneKey,
        },
      },
      update: {
        zoneTitle: payload.zoneTitle,
        progressPercent: payload.progressPercent,
        status: payload.status,
        notes: payload.notes ?? null,
      },
      create: {
        workspaceId,
        zoneKey: payload.zoneKey,
        zoneTitle: payload.zoneTitle,
        progressPercent: payload.progressPercent,
        status: payload.status,
        notes: payload.notes ?? null,
      },
    });

    await createConstructorTimelineEvent({
      workspaceId,
      dealId: scoped.workspace.dealId,
      productionFlowId: scoped.workspace.productionFlowId ?? null,
      actorUserId: scoped.user.id,
      eventType: "ZONE_PROGRESS_UPDATED",
      title: "Обновлен прогресс зоны",
      description: `${payload.zoneTitle}: ${payload.progressPercent}%`,
      metadataJson: { zoneKey: payload.zoneKey },
    });

    return jsonSuccess(scoped.requestId, { data });
  } catch (e) {
    return jsonError(scoped.requestId, e instanceof Error ? e.message : "Ошибка обновления зоны", 400);
  }
}
