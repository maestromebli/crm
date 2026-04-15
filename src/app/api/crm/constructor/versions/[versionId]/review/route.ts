import { jsonError, jsonSuccess } from "@/lib/api/http";
import { prisma } from "@/lib/prisma";
import { requireSessionUser } from "@/lib/authz/api-guard";
import { canReviewConstructorVersion } from "@/features/constructor-hub/server/constructor-rbac";
import { reviewConstructorVersion } from "@/features/constructor-hub/server/constructor-review.service";

type Ctx = { params: Promise<{ versionId: string }> };

export async function POST(request: Request, context: Ctx) {
  const user = await requireSessionUser();
  if (user instanceof Response) return user;
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  const { versionId } = await context.params;

  const version = await prisma.constructorVersion.findUnique({
    where: { id: versionId },
    include: {
      workspace: {
        include: {
          deal: { select: { ownerId: true } },
        },
      },
    },
  });
  if (!version) return jsonError(requestId, "Версия не найдена", 404);
  const scope = {
    ...version.workspace,
    dealOwnerId: version.workspace.deal.ownerId,
  };
  if (!canReviewConstructorVersion(user, scope)) {
    return jsonError(requestId, "Недостаточно прав на review версии", 403);
  }
  try {
    const payload = await request.json();
    const data = await reviewConstructorVersion({
      versionId,
      actorUserId: user.id,
      payload,
    });
    return jsonSuccess(requestId, { data });
  } catch (e) {
    return jsonError(requestId, e instanceof Error ? e.message : "Ошибка review версии", 400);
  }
}
