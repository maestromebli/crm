import { NextResponse } from "next/server";
import { z } from "zod";
import { requireDatabaseUrl } from "@/lib/api/route-guards";
import { requireSessionUser } from "@/lib/authz/api-guard";
import { prisma } from "@/lib/prisma";
import {
  buildAiV2ActorContext,
  buildAiV2ContextSnapshot,
  canReadAiV2Context,
  type AiV2ContextName,
} from "@/features/ai-v2/server";

export const runtime = "nodejs";

const querySchema = z.object({
  context: z.enum(["lead", "deal", "dashboard", "finance", "production", "procurement"]),
  leadId: z.string().optional(),
  dealId: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(30).optional(),
});

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function pickStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((x): x is string => typeof x === "string" && x.trim().length > 0);
}

function entityFilterForContext(context: AiV2ContextName, leadId?: string, dealId?: string) {
  if (context === "lead" && leadId) return { entityType: "LEAD", entityId: leadId } as const;
  if (context === "dashboard") return { entityType: "DASHBOARD", entityId: "dashboard" } as const;
  if (context === "finance" && !dealId) return { entityType: "DASHBOARD", entityId: "finance-dashboard" } as const;
  if (context === "production" && !dealId) {
    return { entityType: "DASHBOARD", entityId: "production-dashboard" } as const;
  }
  if (context === "procurement" && !dealId) {
    return { entityType: "DASHBOARD", entityId: "procurement-dashboard" } as const;
  }
  if ((context === "deal" || context === "finance" || context === "production") && dealId) {
    return { entityType: "DEAL", entityId: dealId } as const;
  }
  if (context === "procurement" && dealId) return { entityType: "DEAL", entityId: dealId } as const;
  return null;
}

export async function GET(request: Request) {
  const dbNotReady = requireDatabaseUrl();
  if (dbNotReady) return dbNotReady;

  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;
  const actor = buildAiV2ActorContext(user);

  const { searchParams } = new URL(request.url);
  const parsed = querySchema.safeParse({
    context: searchParams.get("context"),
    leadId: searchParams.get("leadId") ?? undefined,
    dealId: searchParams.get("dealId") ?? undefined,
    limit: searchParams.get("limit") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Некоректні query параметри" }, { status: 400 });
  }
  const { context, leadId, dealId, limit = 8 } = parsed.data;

  if (!canReadAiV2Context(actor, context)) {
    return NextResponse.json({ error: "Недостатньо прав для AI V2 аудиту" }, { status: 403 });
  }

  const snapshot = await buildAiV2ContextSnapshot({
    actor,
    context,
    leadId,
    dealId,
  });
  if (!snapshot) {
    return NextResponse.json({ error: "Контекст аудиту недоступний" }, { status: 404 });
  }

  const entityFilter = entityFilterForContext(context, leadId, dealId);
  if (!entityFilter) {
    return NextResponse.json({ error: "Потрібен leadId або dealId для обраного контексту" }, { status: 400 });
  }

  const rows = await prisma.aiAssistantLog.findMany({
    where: {
      action: "ai_v2.insight",
      entityType: entityFilter.entityType,
      entityId: entityFilter.entityId,
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      createdAt: true,
      model: true,
      metadata: true,
      user: { select: { id: true, name: true, email: true } },
    },
  });

  const items = rows.map((row) => {
    const meta = asObject(row.metadata);
    return {
      id: row.id,
      createdAt: row.createdAt.toISOString(),
      model: row.model,
      user: row.user,
      riskScore:
        typeof meta.riskScore === "number" && Number.isFinite(meta.riskScore)
          ? Math.round(meta.riskScore)
          : null,
      plannedActions: pickStringArray(meta.plannedActions),
      executedActions: pickStringArray(meta.executedActions),
      blockers: pickStringArray(meta.blockers),
    };
  });

  return NextResponse.json({ items });
}
