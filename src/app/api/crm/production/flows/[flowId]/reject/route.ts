import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSessionUser } from "@/lib/authz/api-guard";
import { canManageProduction } from "@/features/production/server/permissions/production-permissions";
import { rejectLatestPackage } from "@/features/production/server/services/production-approval.service";

type Ctx = { params: Promise<{ flowId: string }> };

const schema = z.object({
  reason: z.string().min(3),
});

export async function POST(request: Request, context: Ctx) {
  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;
  if (!canManageProduction(user)) {
    return NextResponse.json({ error: "Недостатньо прав" }, { status: 403 });
  }
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Вкажіть причину повернення" }, { status: 400 });
  }
  const { flowId } = await context.params;
  await rejectLatestPackage(flowId, user.id, parsed.data.reason);
  return NextResponse.json({ ok: true });
}
