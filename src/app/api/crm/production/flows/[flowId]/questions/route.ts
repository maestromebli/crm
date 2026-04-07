import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSessionUser } from "@/lib/authz/api-guard";
import { canViewProduction } from "@/features/production/server/permissions/production-permissions";
import { addFlowQuestion } from "@/features/production/server/services/production-flow.service";

type Ctx = { params: Promise<{ flowId: string }> };

const schema = z.object({
  text: z.string().min(2),
  source: z.string().optional(),
  isCritical: z.boolean().optional(),
});

export async function POST(request: Request, context: Ctx) {
  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;
  if (!canViewProduction(user)) {
    return NextResponse.json({ error: "Недостатньо прав" }, { status: 403 });
  }
  const { flowId } = await context.params;
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Некоректні дані питання" }, { status: 400 });
  }
  const question = await addFlowQuestion(flowId, { actorName: user.id, ...parsed.data });
  return NextResponse.json({ ok: true, questionId: question.id });
}
