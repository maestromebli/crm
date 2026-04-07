import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import type { EstimateLineType, EstimateStatus } from "@prisma/client";
import { prisma } from "../../../../../lib/prisma";
import {
  forbidUnlessDealAccess,
  requireSessionUser,
} from "../../../../../lib/authz/api-guard";
import { P } from "../../../../../lib/authz/permissions";
import { recalculateEstimateTotals } from "../../../../../lib/estimates/recalculate";
import { serializeEstimateForClient } from "../../../../../lib/estimates/serialize";

type Ctx = { params: Promise<{ dealId: string }> };

function estimateToJson(
  e: {
    id: string;
    dealId: string;
    version: number;
    status: EstimateStatus;
    totalPrice: number | null;
    totalCost: number | null;
    grossMargin: number | null;
    discountAmount: number | null;
    deliveryCost: number | null;
    installationCost: number | null;
    notes: string | null;
    createdById: string;
    approvedById: string | null;
    createdAt: Date;
    updatedAt: Date;
    lineItems?: Array<{
      id: string;
      type: EstimateLineType;
      category: string | null;
      productName: string;
      qty: number;
      unit: string;
      salePrice: number;
      costPrice: number | null;
      amountSale: number;
      amountCost: number | null;
      margin: number | null;
      metadataJson: unknown;
    }>;
  },
) {
  return {
    id: e.id,
    dealId: e.dealId,
    version: e.version,
    status: e.status,
    totalPrice: e.totalPrice,
    totalCost: e.totalCost,
    grossMargin: e.grossMargin,
    discountAmount: e.discountAmount,
    deliveryCost: e.deliveryCost,
    installationCost: e.installationCost,
    notes: e.notes,
    createdById: e.createdById,
    approvedById: e.approvedById,
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
    lineItems: (e.lineItems ?? []).map((li) => ({
      id: li.id,
      type: li.type,
      category: li.category,
      productName: li.productName,
      qty: li.qty,
      unit: li.unit,
      salePrice: li.salePrice,
      costPrice: li.costPrice,
      amountSale: li.amountSale,
      amountCost: li.amountCost,
      margin: li.margin,
      metadataJson: li.metadataJson,
    })),
  };
}

export async function GET(_req: Request, ctx: Ctx) {
  if (!process.env.DATABASE_URL?.trim()) {
    return NextResponse.json(
      { error: "DATABASE_URL не задано" },
      { status: 503 },
    );
  }

  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;

  const { dealId } = await ctx.params;
  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    select: { ownerId: true },
  });
  if (!deal) {
    return NextResponse.json({ error: "Угоду не знайдено" }, { status: 404 });
  }
  const access = await forbidUnlessDealAccess(user, P.ESTIMATES_VIEW, deal);
  if (access) return access;

  try {
    const rows = await prisma.estimate.findMany({
      where: { dealId },
      orderBy: { version: "desc" },
      include: { lineItems: true },
    });

    const authz = {
      realRole: user.realRole,
      impersonatorId: user.impersonatorId,
    };
    const items = rows.map((r) =>
      serializeEstimateForClient(
        estimateToJson(r) as Record<string, unknown>,
        user.permissionKeys,
        authz,
      ),
    );

    return NextResponse.json({ items });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[GET estimates]", e);
    return NextResponse.json(
      { error: "Помилка завантаження смет" },
      { status: 500 },
    );
  }
}

export async function POST(req: Request, ctx: Ctx) {
  if (!process.env.DATABASE_URL?.trim()) {
    return NextResponse.json(
      { error: "DATABASE_URL не задано" },
      { status: 503 },
    );
  }

  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;

  const { dealId } = await ctx.params;

  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    select: { ownerId: true },
  });
  if (!deal) {
    return NextResponse.json({ error: "Угоду не знайдено" }, { status: 404 });
  }

  const access = await forbidUnlessDealAccess(user, P.ESTIMATES_CREATE, deal);
  if (access) return access;

  let body: { cloneFromEstimateId?: string };
  try {
    body = (await req.json()) as { cloneFromEstimateId?: string };
  } catch {
    body = {};
  }

  try {
    const last = await prisma.estimate.findFirst({
      where: { dealId },
      orderBy: { version: "desc" },
      select: { version: true },
    });
    const version = (last?.version ?? 0) + 1;

    let lineData: Array<{
      type: EstimateLineType;
      category: string | null;
      productName: string;
      qty: number;
      unit: string;
      salePrice: number;
      costPrice: number | null;
      amountSale: number;
      amountCost: number | null;
      margin: number | null;
      metadataJson?: unknown;
    }> = [];

    if (typeof body.cloneFromEstimateId === "string" && body.cloneFromEstimateId) {
      const src = await prisma.estimate.findFirst({
        where: { id: body.cloneFromEstimateId, dealId },
        include: { lineItems: true },
      });
      if (src) {
        lineData = src.lineItems.map((li) => ({
          type: li.type,
          category: li.category,
          productName: li.productName,
          qty: li.qty,
          unit: li.unit,
          salePrice: li.salePrice,
          costPrice: li.costPrice,
          amountSale: li.amountSale,
          amountCost: li.amountCost,
          margin: li.margin,
          metadataJson: li.metadataJson ?? undefined,
        }));
      }
    }

    const discountAmount = 0;
    const deliveryCost = 0;
    const installationCost = 0;
    const totals = recalculateEstimateTotals(
      lineData.map((l) => ({
        amountSale: l.amountSale,
        amountCost: l.amountCost,
      })),
      discountAmount,
      deliveryCost,
      installationCost,
    );

    const created = await prisma.$transaction(async (tx) => {
      const est = await tx.estimate.create({
        data: {
          dealId,
          version,
          status: "DRAFT",
          totalPrice: totals.totalPrice,
          totalCost: totals.totalCost,
          grossMargin: totals.grossMargin,
          discountAmount,
          deliveryCost,
          installationCost,
          createdById: user.id,
          lineItems: {
            create: lineData.map((l) => ({
              type: l.type,
              category: l.category,
              productName: l.productName,
              qty: l.qty,
              unit: l.unit,
              salePrice: l.salePrice,
              costPrice: l.costPrice,
              amountSale: l.amountSale,
              amountCost: l.amountCost,
              margin: l.margin,
              ...(l.metadataJson !== undefined && l.metadataJson !== null
                ? { metadataJson: l.metadataJson as object }
                : {}),
            })),
          },
        },
        include: { lineItems: true },
      });
      return est;
    });

    revalidatePath(`/deals/${dealId}/workspace`);

    return NextResponse.json({
      ok: true,
      estimate: serializeEstimateForClient(
        estimateToJson(created) as Record<string, unknown>,
        user.permissionKeys,
        {
          realRole: user.realRole,
          impersonatorId: user.impersonatorId,
        },
      ),
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[POST estimates]", e);
    return NextResponse.json(
      { error: "Помилка створення смети" },
      { status: 500 },
    );
  }
}
