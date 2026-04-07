import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import type { EstimateLineType, EstimateStatus } from "@prisma/client";
import {
  forbidUnlessLeadAccess,
  requireSessionUser,
} from "../../../../../../lib/authz/api-guard";
import { P } from "../../../../../../lib/authz/permissions";
import { recalculateEstimateTotals } from "../../../../../../lib/estimates/recalculate";
import { serializeEstimateForClient } from "../../../../../../lib/estimates/serialize";
import {
  prisma,
  prismaCodegenIncludesEstimateLeadId,
} from "../../../../../../lib/prisma";

type Ctx = { params: Promise<{ leadId: string; estimateId: string }> };

const STATUSES: EstimateStatus[] = [
  "DRAFT",
  "SENT",
  "APPROVED",
  "REJECTED",
  "SUPERSEDED",
];

const LINE_TYPES: EstimateLineType[] = [
  "PRODUCT",
  "SERVICE",
  "DELIVERY",
  "INSTALLATION",
  "DISCOUNT",
  "OTHER",
];

function estimateToJson(
  e: {
    id: string;
    leadId: string | null;
    dealId: string | null;
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
    lineItems: Array<{
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
    leadId: e.leadId,
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
    lineItems: e.lineItems.map((li) => ({
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

  if (!prismaCodegenIncludesEstimateLeadId()) {
    return NextResponse.json(
      { error: "Прорахунки по ліду недоступні" },
      { status: 503 },
    );
  }

  const { leadId, estimateId } = await ctx.params;

  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { id: true, ownerId: true },
  });
  if (!lead) {
    return NextResponse.json({ error: "Лід не знайдено" }, { status: 404 });
  }
  const access = await forbidUnlessLeadAccess(user, P.ESTIMATES_VIEW, lead);
  if (access) return access;

  const row = await prisma.estimate.findFirst({
    where: { id: estimateId, leadId },
    include: { lineItems: { orderBy: { createdAt: "asc" } } },
  });
  if (!row) {
    return NextResponse.json({ error: "Смету не знайдено" }, { status: 404 });
  }

  return NextResponse.json({
    estimate: serializeEstimateForClient(
      estimateToJson(row) as Record<string, unknown>,
      user.permissionKeys,
      {
        realRole: user.realRole,
        impersonatorId: user.impersonatorId,
      },
    ),
  });
}

export async function PATCH(req: Request, ctx: Ctx) {
  if (!process.env.DATABASE_URL?.trim()) {
    return NextResponse.json(
      { error: "DATABASE_URL не задано" },
      { status: 503 },
    );
  }

  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;

  if (!prismaCodegenIncludesEstimateLeadId()) {
    return NextResponse.json(
      { error: "Прорахунки по ліду недоступні" },
      { status: 503 },
    );
  }

  const { leadId, estimateId } = await ctx.params;

  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { id: true, ownerId: true, dealId: true },
  });
  if (!lead) {
    return NextResponse.json({ error: "Лід не знайдено" }, { status: 404 });
  }
  if (lead.dealId) {
    return NextResponse.json(
      {
        error:
          "Лід привʼязаний до угоди — редагуйте прорахунок у картці угоди",
      },
      { status: 409 },
    );
  }
  const access = await forbidUnlessLeadAccess(user, P.ESTIMATES_UPDATE, lead);
  if (access) return access;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Некоректний JSON" }, { status: 400 });
  }

  const existing = await prisma.estimate.findFirst({
    where: { id: estimateId, leadId },
    include: { lineItems: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Смету не знайдено" }, { status: 404 });
  }

  const notes =
    body.notes === null || typeof body.notes === "string"
      ? body.notes === null
        ? null
        : String(body.notes)
      : undefined;

  let status: EstimateStatus | undefined;
  if (
    typeof body.status === "string" &&
    STATUSES.includes(body.status as EstimateStatus)
  ) {
    status = body.status as EstimateStatus;
  }

  let discountAmount = existing.discountAmount ?? 0;
  if (
    typeof body.discountAmount === "number" &&
    Number.isFinite(body.discountAmount)
  ) {
    discountAmount = body.discountAmount;
  }
  let deliveryCost = existing.deliveryCost ?? 0;
  if (
    typeof body.deliveryCost === "number" &&
    Number.isFinite(body.deliveryCost)
  ) {
    deliveryCost = body.deliveryCost;
  }
  let installationCost = existing.installationCost ?? 0;
  if (
    typeof body.installationCost === "number" &&
    Number.isFinite(body.installationCost)
  ) {
    installationCost = body.installationCost;
  }

  type LineIn = {
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
  };

  let newLines: LineIn[] | null = null;
  if (Array.isArray(body.lineItems)) {
    newLines = [];
    for (const raw of body.lineItems as Record<string, unknown>[]) {
      const type = raw.type as EstimateLineType;
      if (!LINE_TYPES.includes(type)) {
        return NextResponse.json(
          { error: `Некоректний тип рядка: ${String(raw.type)}` },
          { status: 400 },
        );
      }
      const productName =
        typeof raw.productName === "string" ? raw.productName.trim() : "";
      if (!productName) {
        return NextResponse.json(
          { error: "Кожен рядок потребує productName" },
          { status: 400 },
        );
      }
      const qty =
        typeof raw.qty === "number" && Number.isFinite(raw.qty) ? raw.qty : 0;
      const unit =
        typeof raw.unit === "string" && raw.unit.trim() ? raw.unit.trim() : "шт";
      const salePrice =
        typeof raw.salePrice === "number" && Number.isFinite(raw.salePrice)
          ? raw.salePrice
          : 0;
      const costPrice =
        raw.costPrice === null || raw.costPrice === undefined
          ? null
          : typeof raw.costPrice === "number" && Number.isFinite(raw.costPrice)
            ? raw.costPrice
            : null;
      const amountSale =
        typeof raw.amountSale === "number" && Number.isFinite(raw.amountSale)
          ? raw.amountSale
          : qty * salePrice;
      const amountCost =
        costPrice === null
          ? null
          : typeof raw.amountCost === "number" && Number.isFinite(raw.amountCost)
            ? raw.amountCost
            : qty * (costPrice ?? 0);
      const margin =
        amountCost === null ? null : amountSale - amountCost;
      newLines.push({
        type,
        category:
          typeof raw.category === "string" ? raw.category.trim() || null : null,
        productName,
        qty,
        unit,
        salePrice,
        costPrice,
        amountSale,
        amountCost,
        margin,
        metadataJson: raw.metadataJson,
      });
    }
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      if (newLines) {
        await tx.estimateLineItem.deleteMany({
          where: { estimateId: existing.id },
        });
        if (newLines.length > 0) {
          await tx.estimateLineItem.createMany({
            data: newLines.map((l) => ({
              estimateId: existing.id,
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
          });
        }
      }

      const linesForCalc = newLines
        ? newLines.map((l) => ({
            amountSale: l.amountSale,
            amountCost: l.amountCost,
          }))
        : existing.lineItems.map((l) => ({
            amountSale: l.amountSale,
            amountCost: l.amountCost,
          }));

      const totals = recalculateEstimateTotals(
        linesForCalc,
        discountAmount,
        deliveryCost,
        installationCost,
      );

      return tx.estimate.update({
        where: { id: existing.id },
        data: {
          ...(notes !== undefined ? { notes } : {}),
          ...(status !== undefined ? { status } : {}),
          discountAmount,
          deliveryCost,
          installationCost,
          totalPrice: totals.totalPrice,
          totalCost: totals.totalCost,
          grossMargin: totals.grossMargin,
        },
        include: { lineItems: { orderBy: { createdAt: "asc" } } },
      });
    });

    revalidatePath(`/leads/${leadId}`);
    revalidatePath(`/leads/${leadId}/estimate/${estimateId}`);

    return NextResponse.json({
      ok: true,
      estimate: serializeEstimateForClient(
        estimateToJson(updated) as Record<string, unknown>,
        user.permissionKeys,
        {
          realRole: user.realRole,
          impersonatorId: user.impersonatorId,
        },
      ),
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[PATCH lead estimate]", e);
    return NextResponse.json(
      { error: "Помилка збереження смети" },
      { status: 500 },
    );
  }
}
