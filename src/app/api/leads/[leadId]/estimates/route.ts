import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { Prisma, type EstimateLineType } from "@prisma/client";
import {
  forbidUnlessLeadAccess,
  forbidUnlessPermission,
  requireSessionUser,
} from "../../../../../lib/authz/api-guard";
import { P } from "../../../../../lib/authz/permissions";
import {
  buildFurnitureSheetLinesForDb,
  FURNITURE_TEMPLATE_KEYS,
  KITCHEN_NO_COUNTER_TEMPLATE_KEY,
  type FurnitureTemplateKey,
} from "../../../../../lib/estimates/kitchen-cost-sheet-template";
import { newEstimateStableLineId } from "../../../../../lib/estimates/new-stable-line-id";
import { calculateEstimateTotalsFromLines } from "../../../../../features/estimate-core";
import { recordEstimateLearningSnapshot } from "../../../../../lib/estimates/estimate-learning";
import {
  prisma,
  prismaCodegenIncludesEstimateLeadId,
  prismaCodegenIncludesEstimateName,
} from "../../../../../lib/prisma";
import { CORE_EVENT_TYPES, publishEntityEvent } from "../../../../../lib/events/crm-events";
import { recordWorkflowEvent, WORKFLOW_EVENT_TYPES } from "../../../../../features/event-system";

type Ctx = { params: Promise<{ leadId: string }> };

const FURNITURE_TEMPLATE_KEY_SET = new Set<string>(FURNITURE_TEMPLATE_KEYS);
const ESTIMATE_CREATE_PRECONDITION = {
  SESSION_USER_NOT_FOUND: "SESSION_USER_NOT_FOUND",
  LEAD_NOT_FOUND: "LEAD_NOT_FOUND",
  LEAD_ALREADY_CONVERTED: "LEAD_ALREADY_CONVERTED",
} as const;
type EstimateCreatePreconditionCode =
  (typeof ESTIMATE_CREATE_PRECONDITION)[keyof typeof ESTIMATE_CREATE_PRECONDITION];

function mapKitchenSeedLines(
  lines: ReturnType<typeof buildFurnitureSheetLinesForDb>,
): Array<{
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
}> {
  return lines.map((l) => ({
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
    metadataJson: l.metadataJson,
  }));
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
      { error: "Лід уже привʼязаний до замовлення — прорахунки ведуться в замовленні" },
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
    /** Підтримка клієнта «Розрахунок вартості» (LeadPricingWorkspaceClient). */
    estimateName?: string | null;
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

  const estimateName =
    typeof body.estimateName === "string" && body.estimateName.trim()
      ? body.estimateName.trim().slice(0, 200)
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
      /** Якщо клонуємо з іншої смети — зберігаємо стабільний id рядка. */
      stableLineId?: string | null;
      sortOrder?: number;
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
          stableLineId: li.stableLineId ?? null,
          sortOrder: li.sortOrder,
        }));
      }
    }

    if (lineData.length === 0) {
      if (templateKey && FURNITURE_TEMPLATE_KEY_SET.has(templateKey)) {
        lineData = mapKitchenSeedLines(
          buildFurnitureSheetLinesForDb(templateKey as FurnitureTemplateKey),
        );
      } else if (templateKey === "kitchen") {
        lineData = mapKitchenSeedLines(
          buildFurnitureSheetLinesForDb(KITCHEN_NO_COUNTER_TEMPLATE_KEY),
        );
      } else {
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
    }

    const discountAmount = 0;
    const deliveryCost = 0;
    const installationCost = 0;
    const totals = calculateEstimateTotalsFromLines(
      lineData.map((l) => ({
        amountSale: l.amountSale,
        amountCost: l.amountCost,
      })),
      discountAmount,
      deliveryCost,
      installationCost,
    );

    const created = await prisma.$transaction(async (tx) => {
      const [dbUser, dbLead] = await Promise.all([
        tx.user.findUnique({
          where: { id: user.id },
          select: { id: true },
        }),
        tx.lead.findUnique({
          where: { id: leadId },
          select: { id: true, dealId: true },
        }),
      ]);
      if (!dbUser) {
        throw new Error(ESTIMATE_CREATE_PRECONDITION.SESSION_USER_NOT_FOUND);
      }
      if (!dbLead) {
        throw new Error(ESTIMATE_CREATE_PRECONDITION.LEAD_NOT_FOUND);
      }
      if (dbLead.dealId) {
        throw new Error(ESTIMATE_CREATE_PRECONDITION.LEAD_ALREADY_CONVERTED);
      }

      return tx.estimate.create({
        data: {
          leadId,
          dealId: null,
          version,
          status: "DRAFT",
          templateKey,
          ...(prismaCodegenIncludesEstimateName() && estimateName
            ? { name: estimateName }
            : {}),
          totalPrice: totals.totalPrice,
          totalCost: totals.totalCost,
          grossMargin: totals.grossMargin,
          discountAmount,
          deliveryCost,
          installationCost,
          createdById: user.id,
          lineItems: {
            create: lineData.map((l, idx) => ({
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
              stableLineId:
                typeof l.stableLineId === "string" && l.stableLineId.trim()
                  ? l.stableLineId.trim()
                  : newEstimateStableLineId(),
              sortOrder:
                typeof l.sortOrder === "number" && Number.isFinite(l.sortOrder)
                  ? l.sortOrder
                  : idx,
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
    await publishEntityEvent({
      type: CORE_EVENT_TYPES.ESTIMATE_CREATED,
      entityType: "LEAD",
      entityId: leadId,
      userId: user.id,
      payload: {
        estimateId: created.id,
        estimateVersion: created.version,
      },
    });
    await recordWorkflowEvent(
      WORKFLOW_EVENT_TYPES.CALCULATION_VERSION_CREATED,
      { leadId, estimateId: created.id },
      {
        entityType: "LEAD",
        entityId: leadId,
        userId: user.id,
        dedupeKey: `estimate-created:${created.id}`,
      },
    );
    await recordEstimateLearningSnapshot({
      userId: user.id,
      leadId,
      estimateId: created.id,
      lineItems: created.lineItems.map((li) => ({
        productName: li.productName,
        salePrice: li.salePrice,
        qty: li.qty,
        amountSale: li.amountSale,
      })),
      totalPrice: created.totalPrice,
    });

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
    console.error("[POST leads/[leadId]/estimates]", e);
    if (e instanceof Error) {
      const code = e.message as EstimateCreatePreconditionCode;
      if (code === ESTIMATE_CREATE_PRECONDITION.SESSION_USER_NOT_FOUND) {
        return NextResponse.json(
          { error: "Користувача сесії не знайдено в БД. Перелогіньтесь і спробуйте ще раз." },
          { status: 401 },
        );
      }
      if (code === ESTIMATE_CREATE_PRECONDITION.LEAD_NOT_FOUND) {
        return NextResponse.json({ error: "Лід не знайдено" }, { status: 404 });
      }
      if (code === ESTIMATE_CREATE_PRECONDITION.LEAD_ALREADY_CONVERTED) {
        return NextResponse.json(
          { error: "Лід уже привʼязаний до замовлення — прорахунки ведуться в замовленні" },
          { status: 409 },
        );
      }
    }
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      if (e.code === "P2002") {
        return NextResponse.json(
          {
            error:
              "Конфлікт версії розрахунку — оновіть сторінку й спробуйте ще раз.",
          },
          { status: 409 },
        );
      }
      if (e.code === "P2003") {
        return NextResponse.json(
          {
            error:
              "Не вдалося зберегти розрахунок (порушення зв’язків у БД). Перевірте користувача та лід.",
          },
          { status: 400 },
        );
      }
    }
    return NextResponse.json(
      { error: "Не вдалося створити розрахунок" },
      { status: 500 },
    );
  }
}
