import { NextResponse } from "next/server";
import {
  forbidUnlessLeadAccess,
  requireSessionUser,
} from "../../../../../lib/authz/api-guard";
import { P } from "../../../../../lib/authz/permissions";
import {
  mapEstimateRowToVersionDto,
  mapEstimateToListItemDto,
  type EstimateMiniDto,
  type EstimateWorkspaceResponse,
} from "../../../../../lib/estimates/estimate-workspace-dto";
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

  if (!prismaCodegenIncludesEstimateLeadId()) {
    return NextResponse.json(
      { error: "Прорахунки по ліду недоступні" },
      { status: 503 },
    );
  }

  const { leadId } = await ctx.params;

  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: {
      id: true,
      title: true,
      contactName: true,
      phone: true,
      ownerId: true,
      activeEstimateId: true,
      stage: { select: { name: true } },
    },
  });
  if (!lead) {
    return NextResponse.json({ error: "Лід не знайдено" }, { status: 404 });
  }

  const denied = await forbidUnlessLeadAccess(user, P.ESTIMATES_VIEW, lead);
  if (denied) return denied;

  const anchor = await prisma.estimate.findFirst({
    where: { leadId },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });

  const versionRows = await prisma.estimate.findMany({
    where: { leadId },
    orderBy: { version: "desc" },
    select: {
      id: true,
      version: true,
      status: true,
      totalPrice: true,
      discountAmount: true,
      changeSummary: true,
      createdAt: true,
      createdById: true,
      templateKey: true,
      createdBy: { select: { id: true, name: true } },
    },
  });

  const activeEstimateId = lead.activeEstimateId;

  const currentVersionRow = activeEstimateId
    ? await prisma.estimate.findFirst({
        where: { id: activeEstimateId, leadId },
        include: {
          lineItems: {
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          },
          createdBy: { select: { id: true, name: true } },
        },
      })
    : null;

  const containerId = anchor?.id ?? versionRows[0]?.id ?? "";

  const estimateMini: EstimateMiniDto | null =
    versionRows.length === 0 || !containerId
      ? null
      : {
          id: containerId,
          name:
            currentVersionRow?.templateKey?.trim() ||
            lead.title ||
            null,
          currency: "UAH",
          currentVersionId: activeEstimateId,
        };

  const versionHistory =
    containerId === ""
      ? []
      : versionRows.map((r) =>
          mapEstimateToListItemDto(r, {
            containerEstimateId: containerId,
            activeEstimateId,
          }),
        );

  const body: EstimateWorkspaceResponse = {
    lead: {
      id: lead.id,
      title: lead.title,
      customerName: lead.contactName,
      phone: lead.phone,
      stage: lead.stage?.name ?? null,
    },
    estimate: estimateMini,
    currentVersion:
      currentVersionRow && containerId
        ? mapEstimateRowToVersionDto(
            {
              ...currentVersionRow,
              lineItems: currentVersionRow.lineItems.map((li) => ({
                id: li.id,
                sortOrder: li.sortOrder,
                stableLineId: li.stableLineId,
                sectionId: li.sectionId,
                category: li.category,
                code: li.code,
                productName: li.productName,
                qty: li.qty,
                unit: li.unit,
                salePrice: li.salePrice,
                amountSale: li.amountSale,
                supplierRef: li.supplierRef,
                notes: li.notes,
                metadataJson: li.metadataJson,
              })),
            },
            { containerEstimateId: containerId, activeEstimateId },
          )
        : null,
    versionHistory,
  };

  return NextResponse.json(body);
}
