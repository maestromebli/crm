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
    select: { installationDate: true, workspaceMeta: true, updatedAt: true },
  });
  return NextResponse.json({
    ok: true,
    data: {
      installationDate: deal?.installationDate?.toISOString() ?? null,
      workspaceMeta: (deal?.workspaceMeta as Record<string, unknown> | null) ?? {},
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
  const updated = await prisma.deal.update({
    where: { id: dealId },
    data: {
      installationDate:
        typeof body.installationDate === "string" && body.installationDate.trim()
          ? new Date(body.installationDate)
          : undefined,
      workspaceMeta: {
        ...meta,
        siteReadinessConfirmed: Boolean(
          body.siteReadinessConfirmed ?? meta.siteReadinessConfirmed ?? false,
        ),
        installationNotes:
          typeof body.installationNotes === "string"
            ? body.installationNotes
            : meta.installationNotes ?? null,
      },
    },
    select: { installationDate: true, updatedAt: true },
  });

  return NextResponse.json({
    ok: true,
    data: {
      installationDate: updated.installationDate?.toISOString() ?? null,
      updatedAt: updated.updatedAt.toISOString(),
    },
  });
}
