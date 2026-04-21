import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import type { EstimateStatus } from "@prisma/client";
import { prisma } from "../../../../../../lib/prisma";
import {
  forbidUnlessDealAccess,
  requireSessionUser,
} from "../../../../../../lib/authz/api-guard";
import { P } from "../../../../../../lib/authz/permissions";
import { calculateEstimateTotalsFromLines } from "../../../../../../features/estimate-core";
import { estimateApiRowToJson } from "../../../../../../lib/estimates/estimate-api-json";
import { recordEstimateLearningSnapshot } from "../../../../../../lib/estimates/estimate-learning";
import { parseEstimatePatchLineItems } from "../../../../../../lib/estimates/parse-estimate-lines";
import { serializeEstimateForClient } from "../../../../../../lib/estimates/serialize";

type Ctx = { params: Promise<{ dealId: string; estimateId: string }> };

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

  const { dealId, estimateId } = await ctx.params;

  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    select: { ownerId: true },
  });
  if (!deal) {
    return NextResponse.json({ error: "Замовлення не знайдено" }, { status: 404 });
  }
  const access = await forbidUnlessDealAccess(user, P.ESTIMATES_VIEW, deal);
  if (access) return access;

  const row = await prisma.estimate.findFirst({
    where: { id: estimateId, dealId },
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

  const { dealId, estimateId } = await ctx.params;

  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    select: { ownerId: true },
  });
  if (!deal) {
    return NextResponse.json({ error: "Замовлення не знайдено" }, { status: 404 });
  }
  const access = await forbidUnlessDealAccess(user, P.ESTIMATES_UPDATE, deal);
  if (access) return access;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Некоректний JSON" }, { status: 400 });
  }

  const existing = await prisma.estimate.findFirst({
    where: { id: estimateId, dealId },
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
  if (typeof body.status === "string" && STATUSES.includes(body.status as EstimateStatus)) {
    status = body.status as EstimateStatus;
  }

  let discountAmount = existing.discountAmount ?? 0;
  if (typeof body.discountAmount === "number" && Number.isFinite(body.discountAmount)) {
    discountAmount = body.discountAmount;
  }
  let deliveryCost = existing.deliveryCost ?? 0;
  if (typeof body.deliveryCost === "number" && Number.isFinite(body.deliveryCost)) {
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

    revalidatePath(`/deals/${dealId}/workspace`);
    await recordEstimateLearningSnapshot({
      userId: user.id,
      dealId,
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
    console.error("[PATCH estimate]", e);
    return NextResponse.json(
      { error: "Помилка збереження смети" },
      { status: 500 },
    );
  }
}
