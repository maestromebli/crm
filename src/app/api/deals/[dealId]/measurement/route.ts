import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireDealAccess } from "@/lib/deal-hub-api/access";
import { P } from "@/lib/authz/permissions";

type Ctx = { params: Promise<{ dealId: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { dealId } = await ctx.params;
  const access = await requireDealAccess(dealId);
  if ("error" in access) return access.error;
  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    select: { controlMeasurementJson: true, workspaceMeta: true, updatedAt: true },
  });
  return NextResponse.json({
    ok: true,
    data: {
      controlMeasurement: deal?.controlMeasurementJson ?? null,
      workspaceMeasurement: (deal?.workspaceMeta as Record<string, unknown> | null) ?? {},
      updatedAt: deal?.updatedAt?.toISOString() ?? null,
    },
  });
}

export async function PATCH(req: Request, ctx: Ctx) {
  const { dealId } = await ctx.params;
  const access = await requireDealAccess(dealId, P.DEALS_UPDATE);
  if ("error" in access) return access.error;

  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const current = await prisma.deal.findUnique({
    where: { id: dealId },
    select: { workspaceMeta: true },
  });
  const meta = ((current?.workspaceMeta ?? {}) as Record<string, unknown>) ?? {};
  const nextMeta = {
    ...meta,
    measurementComplete: Boolean(body.measurementComplete ?? meta.measurementComplete ?? false),
    measurementNotes:
      typeof body.measurementNotes === "string"
        ? body.measurementNotes
        : meta.measurementNotes ?? null,
  };

  const updated = await prisma.deal.update({
    where: { id: dealId },
    data: {
      workspaceMeta: nextMeta,
      controlMeasurementJson:
        body.controlMeasurement && typeof body.controlMeasurement === "object"
          ? (body.controlMeasurement as any)
          : undefined,
    },
    select: { updatedAt: true },
  });

  return NextResponse.json({ ok: true, data: { updatedAt: updated.updatedAt.toISOString() } });
}
