import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  forbidUnlessDealAccess,
  requireSessionUser,
} from "@/lib/authz/api-guard";
import { P, hasEffectivePermission } from "@/lib/authz/permissions";
import { assignProductionConstructor } from "@/lib/production-orchestration/service";

type Ctx = { params: Promise<{ dealId: string }> };

type Body = {
  type: "INTERNAL" | "OUTSOURCED";
  constructorUserId?: string | null;
  constructorExternalName?: string | null;
  constructorExternalPhone?: string | null;
  constructorExternalEmail?: string | null;
  dueDate?: string | null;
  productionNotes?: string | null;
  regenerateToken?: boolean;
};

export async function POST(req: Request, ctx: Ctx) {
  if (!process.env.DATABASE_URL?.trim()) {
    return NextResponse.json({ error: "DATABASE_URL не задано" }, { status: 503 });
  }

  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;

  const { dealId } = await ctx.params;

  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    select: { id: true, ownerId: true },
  });
  if (!deal) {
    return NextResponse.json({ error: "Замовлення не знайдено" }, { status: 404 });
  }

  const denied = await forbidUnlessDealAccess(user, P.DEALS_VIEW, deal);
  if (denied) return denied;

  if (
    !hasEffectivePermission(user.permissionKeys, P.PRODUCTION_ORCHESTRATION_MANAGE, {
      realRole: user.realRole,
      impersonatorId: user.impersonatorId,
    })
  ) {
    return NextResponse.json({ error: "Недостатньо прав" }, { status: 403 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Некоректний JSON" }, { status: 400 });
  }

  if (body.type !== "INTERNAL" && body.type !== "OUTSOURCED") {
    return NextResponse.json({ error: "type має бути INTERNAL або OUTSOURCED" }, { status: 400 });
  }

  const dueDate =
    body.dueDate && body.dueDate.trim() ? new Date(body.dueDate) : null;
  if (dueDate && Number.isNaN(dueDate.getTime())) {
    return NextResponse.json({ error: "dueDate некоректна" }, { status: 400 });
  }

  const result = await assignProductionConstructor(prisma, {
    dealId,
    actorUserId: user.id,
    type: body.type,
    constructorUserId: body.constructorUserId,
    constructorExternalName: body.constructorExternalName,
    constructorExternalPhone: body.constructorExternalPhone,
    constructorExternalEmail: body.constructorExternalEmail,
    dueDate,
    productionNotes: body.productionNotes ?? null,
    regenerateToken: Boolean(body.regenerateToken),
  });

  if (result.ok === false) {
    const status =
      result.code === "NOT_FOUND" ? 404 : result.code === "STATE" ? 409 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({
    ok: true,
    orchestrationId: result.orchestrationId,
    externalWorkspaceToken: result.externalWorkspaceToken,
  });
}
