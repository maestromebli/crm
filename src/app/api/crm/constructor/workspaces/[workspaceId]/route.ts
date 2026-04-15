import { jsonError, jsonSuccess } from "@/lib/api/http";
import { prisma } from "@/lib/prisma";
import { requireWorkspaceViewScope } from "@/features/constructor-hub/server/constructor-api-helpers";

type Ctx = { params: Promise<{ workspaceId: string }> };

export async function GET(request: Request, context: Ctx) {
  const { workspaceId } = await context.params;
  const scoped = await requireWorkspaceViewScope({ request, workspaceId });
  if ("errorResponse" in scoped) return scoped.errorResponse;

  const data = await prisma.constructorWorkspace.findUnique({
    where: { id: workspaceId },
    include: {
      techSpec: true,
      questions: { orderBy: { createdAt: "desc" } },
      files: { orderBy: { createdAt: "desc" } },
      versions: { orderBy: { versionNumber: "desc" } },
      reviews: { orderBy: { createdAt: "desc" } },
      checklistItems: { orderBy: { sortOrder: "asc" } },
      zones: { orderBy: { createdAt: "asc" } },
      aiInsights: { orderBy: { createdAt: "desc" } },
      timeline: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!data) {
    return jsonError(scoped.requestId, "Workspace не найден", 404);
  }
  return jsonSuccess(scoped.requestId, { data });
}
