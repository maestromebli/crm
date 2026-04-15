import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSessionUser, forbidUnlessPermission } from "@/lib/authz/api-guard";
import { P } from "@/lib/authz/permissions";
import {
  buildAiContextResult,
  executeAiAction,
  type AiContextName,
} from "@/lib/ai/contextual-engine";
import { recordContinuousLearningEvent } from "@/lib/ai/continuous-learning";

const bodySchema = z.object({
  context: z.enum([
    "lead",
    "deal",
    "finance",
    "procurement",
    "production",
    "dashboard",
  ]),
  dealId: z.string().optional(),
  leadId: z.string().optional(),
  executeActions: z.boolean().optional(),
});

export async function POST(req: Request) {
  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;
  const denied = forbidUnlessPermission(user, P.AI_USE);
  if (denied) return denied;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Некоректний JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Некоректні дані" }, { status: 400 });
  }

  const { context, dealId, leadId, executeActions } = parsed.data as {
    context: AiContextName;
    dealId?: string;
    leadId?: string;
    executeActions?: boolean;
  };

  const ai = await buildAiContextResult({ context, dealId, leadId });
  if (executeActions && dealId) {
    for (const action of ai.actions) {
      await executeAiAction({ dealId, action });
    }
  }
  await recordContinuousLearningEvent({
    userId: user.id,
    action: "ai_contextual_result",
    stage: "contextual",
    entityType: leadId ? "LEAD" : dealId ? "DEAL" : "DASHBOARD",
    entityId: leadId ?? dealId ?? user.id,
    ok: true,
    metadata: {
      context,
      executeActions: Boolean(executeActions),
      insights: ai.insights.length,
      risks: ai.risks.length,
      recommendations: ai.recommendations.length,
      actions: ai.actions.length,
    },
  });
  return NextResponse.json(ai);
}
