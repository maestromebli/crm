import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import type { EstimateLineType } from "@prisma/client";
import {
  forbidUnlessLeadAccess,
  forbidUnlessPermission,
  requireSessionUser,
} from "../../../../../lib/authz/api-guard";
import { P } from "../../../../../lib/authz/permissions";
import { recalculateEstimateTotals } from "../../../../../lib/estimates/recalculate";
import {
  prisma,
  prismaCodegenIncludesEstimateLeadId,
} from "../../../../../lib/prisma";

type Ctx = { params: Promise<{ leadId: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  if (!process.env.DATABASE_URL?.trim()) {
    return NextResponse.json(
      { error: "DATABASE_URL не задано" },
      { status: 503 },
    );
  }

  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;

  const { leadId } = await ctx.params;

  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { id: true, ownerId: true },
  });
  if (!lead) {
    return NextResponse.json({ error: "Лід не знайдено" }, { status: 404 });
  }

  const denied = await forbidUnlessLeadAccess(user, P.LEADS_VIEW, lead);
  if (denied) return denied;

  if (!prismaCodegenIncludesEstimateLeadId()) {
    return NextResponse.json({ items: [] });
  }

  const rows = await prisma.estimate.findMany({
    where: { leadId },
    orderBy: { version: "desc" },
    select: {
      id: true,
      version: true,
      status: true,
      totalPrice: true,
      templateKey: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({
    items: rows.map((r) => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    })),
  });
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

  const estDenied = forbidUnlessPermission(user, P.ESTIMATES_CREATE);
  if (estDenied) return estDenied;

  const { leadId } = await ctx.params;

  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { id: true, ownerId: true, dealId: true },
  });
  if (!lead) {
    return NextResponse.json({ error: "Лід не знайдено" }, { status: 404 });
  }
  if (lead.dealId) {
    return NextResponse.json(
      { error: "Лід уже привʼязаний до угоди — прорахунки ведуться в угоді" },
      { status: 409 },
    );
  }

  const denied = await forbidUnlessLeadAccess(user, P.LEADS_UPDATE, lead);
  if (denied) return denied;

  if (!prismaCodegenIncludesEstimateLeadId()) {
    return NextResponse.json(
      {
        error:
          "Застарілий Prisma Client. Виконайте `pnpm prisma generate` і перезапустіть dev-сервер.",
      },
      { status: 503 },
    );
  }

  let body: {
    templateKey?: string | null;
    cloneFromEstimateId?: string | null;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    body = {};
  }

  const templateKey =
    typeof body.templateKey === "string" && body.templateKey.trim()
      ? body.templateKey.trim().slice(0, 64)
      : null;

  try {
    const last = await prisma.estimate.findFirst({
      where: { leadId },
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

    if (
      typeof body.cloneFromEstimateId === "string" &&
      body.cloneFromEstimateId.trim()
    ) {
      const src = await prisma.estimate.findFirst({
        where: { id: body.cloneFromEstimateId.trim(), leadId },
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

    if (lineData.length === 0) {
      lineData = [
        {
          type: "PRODUCT",
          category: templateKey,
          productName: templateKey
            ? `Шаблон: ${templateKey}`
            : "Позиція 1",
          qty: 1,
          unit: "шт",
          salePrice: 0,
          costPrice: null,
          amountSale: 0,
          amountCost: null,
          margin: null,
        },
      ];
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
      return tx.estimate.create({
        data: {
          leadId,
          dealId: null,
          version,
          status: "DRAFT",
          templateKey,
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
    });

    revalidatePath(`/leads/${leadId}`);
    revalidatePath(`/leads/${leadId}/files`);

    return NextResponse.json({
      ok: true,
      estimate: {
        id: created.id,
        version: created.version,
        status: created.status,
        totalPrice: created.totalPrice,
        templateKey: created.templateKey,
        createdAt: created.createdAt.toISOString(),
      },
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[POST leads/[leadId]/estimates]", e);
    return NextResponse.json(
      { error: "Не вдалося створити прорахунок" },
      { status: 500 },
    );
  }
}
