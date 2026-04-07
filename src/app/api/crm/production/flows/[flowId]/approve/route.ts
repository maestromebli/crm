import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/authz/api-guard";
import { canManageProduction } from "@/features/production/server/permissions/production-permissions";
import { approveLatestPackage } from "@/features/production/server/services/production-approval.service";
import { prisma } from "@/lib/prisma";
import { recordWorkflowEvent, WORKFLOW_EVENT_TYPES } from "@/features/event-system";

type Ctx = { params: Promise<{ flowId: string }> };

export async function POST(_request: Request, context: Ctx) {
  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;
  if (!canManageProduction(user)) {
    return NextResponse.json({ error: "Недостатньо прав" }, { status: 403 });
  }
  const { flowId } = await context.params;
  await approveLatestPackage(flowId, user.id);
  const flow = await prisma.productionFlow.findUnique({
    where: { id: flowId },
    select: { dealId: true },
  });
  if (flow?.dealId) {
    await recordWorkflowEvent(
      WORKFLOW_EVENT_TYPES.FILE_APPROVED,
      { dealId: flow.dealId, attachmentId: flowId },
      {
        entityType: "DEAL",
        entityId: flow.dealId,
        dealId: flow.dealId,
        userId: user.id,
        dedupeKey: `file-approved:production-flow:${flowId}`,
      },
    );
  }
  return NextResponse.json({ ok: true });
}
