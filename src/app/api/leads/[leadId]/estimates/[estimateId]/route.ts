import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import type { EstimateStatus } from "@prisma/client";
import {
  forbidUnlessLeadAccess,
  requireSessionUser,
} from "../../../../../../lib/authz/api-guard";
import { P } from "../../../../../../lib/authz/permissions";
import { calculateEstimateTotalsFromLines } from "../../../../../../features/estimate-core";
import { estimateApiRowToJson } from "../../../../../../lib/estimates/estimate-api-json";
import { recordEstimateLearningSnapshot } from "../../../../../../lib/estimates/estimate-learning";
import { parseEstimatePatchLineItems } from "../../../../../../lib/estimates/parse-estimate-lines";
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
      estimateApiRowToJson(row) as Record<string, unknown>,
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
          "Лід привʼязаний до замовлення — редагуйте прорахунок у картці замовлення",
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

  const parsedLines = parseEstimatePatchLineItems(body.lineItems);
  if (parsedLines.error) {
    return NextResponse.json({ error: parsedLines.error }, { status: 400 });
  }
  const newLines = parsedLines.lines;

  try {
    const updated = await prisma.$transaction(async (tx) => {
      if (newLines) {
        await tx.estimateLineItem.deleteMany({
          where: { estimateId: existing.id },
        });
        if (newLines.length > 0) {
          // Use per-row create to avoid createMany null-constraint issues on
          // environments with partially migrated DB defaults/triggers.
          for (const l of newLines) {
            await tx.estimateLineItem.create({
              data: {
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
              },
            });
          }
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

      const totals = calculateEstimateTotalsFromLines(
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
    await recordEstimateLearningSnapshot({
      userId: user.id,
      leadId,
      estimateId: updated.id,
      lineItems: updated.lineItems.map((li) => ({
        productName: li.productName,
        salePrice: li.salePrice,
        qty: li.qty,
        amountSale: li.amountSale,
      })),
      totalPrice: updated.totalPrice,
    });

    return NextResponse.json({
      ok: true,
      estimate: serializeEstimateForClient(
        estimateApiRowToJson(updated) as Record<string, unknown>,
        user.permissionKeys,
        {
          realRole: user.realRole,
          impersonatorId: user.impersonatorId,
        },
      ),
    });
  } catch (e) {
    console.error("[PATCH lead estimate]", e);
    return NextResponse.json(
      { error: "Помилка збереження смети" },
      { status: 500 },
    );
  }
}
