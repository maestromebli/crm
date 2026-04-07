import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import type { LeadProposalStatus } from "@prisma/client";
import {
  forbidUnlessLeadAccess,
  forbidUnlessPermission,
  requireSessionUser,
} from "../../../../../../lib/authz/api-guard";
import { P } from "../../../../../../lib/authz/permissions";
import { rebuildProposalSnapshotV3 } from "../../../../../../lib/leads/proposal-snapshot";
import { parseQuoteItemsArray } from "../../../../../../lib/quotes/quote-validation";
import {
  prisma,
  prismaCodegenIncludesLeadProposalVisualizationUrl,
} from "../../../../../../lib/prisma";

type Ctx = { params: Promise<{ leadId: string; proposalId: string }> };

const STATUSES: LeadProposalStatus[] = [
  "DRAFT",
  "SENT",
  "CLIENT_REVIEWING",
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

  const estDenied = forbidUnlessPermission(user, P.ESTIMATES_CREATE);
  if (estDenied) return estDenied;

  const { leadId, proposalId } = await ctx.params;

  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { id: true, ownerId: true, dealId: true, title: true },
  });
  if (!lead || lead.dealId) {
    return NextResponse.json({ error: "Лід не знайдено" }, { status: 404 });
  }

  const denied = await forbidUnlessLeadAccess(user, P.LEADS_UPDATE, lead);
  if (denied) return denied;

  const proposal = await prisma.leadProposal.findFirst({
    where: { id: proposalId, leadId },
    include: {
      estimate: {
        include: {
          lineItems: {
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          },
        },
      },
    },
  });
  if (!proposal) {
    return NextResponse.json({ error: "КП не знайдено" }, { status: 404 });
  }

  return NextResponse.json({
    proposal: {
      id: proposal.id,
      version: proposal.version,
      status: proposal.status,
      title: proposal.title,
      summary: proposal.summary,
      notes: proposal.notes,
      snapshotJson: proposal.snapshotJson,
      visualizationUrl: proposal.visualizationUrl,
      publicToken: proposal.publicToken,
      createdAt: proposal.createdAt,
      estimateId: proposal.estimateId,
      estimate: proposal.estimate
        ? {
            id: proposal.estimate.id,
            name: proposal.estimate.name,
            templateKey: proposal.estimate.templateKey,
            version: proposal.estimate.version,
            totalPrice: proposal.estimate.totalPrice,
          }
        : null,
    },
    leadTitle: lead.title,
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

  const estDenied = forbidUnlessPermission(user, P.ESTIMATES_CREATE);
  if (estDenied) return estDenied;

  const { leadId, proposalId } = await ctx.params;

  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { id: true, ownerId: true, dealId: true },
  });
  if (!lead || lead.dealId) {
    return NextResponse.json({ error: "Лід не знайдено" }, { status: 404 });
  }

  const denied = await forbidUnlessLeadAccess(user, P.LEADS_UPDATE, lead);
  if (denied) return denied;

  let body: {
    status?: LeadProposalStatus;
    title?: string | null;
    summary?: string | null;
    markSent?: boolean;
    quoteItems?: unknown;
    visualizationUrl?: string | null;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Некоректний JSON" }, { status: 400 });
  }

  const row = await prisma.leadProposal.findFirst({
    where: { id: proposalId, leadId },
    include: {
      estimate: {
        include: {
          lineItems: {
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          },
        },
      },
    },
  });
  if (!row || !row.estimate) {
    return NextResponse.json(
      { error: "КП не знайдено або без смети" },
      { status: 404 },
    );
  }

  let status = row.status;
  if (typeof body.status === "string" && STATUSES.includes(body.status)) {
    status = body.status;
  }
  if (body.markSent) {
    status = "SENT";
  }

  let snapshotJson = row.snapshotJson;
  if (body.quoteItems !== undefined) {
    const parsed = parseQuoteItemsArray(body.quoteItems);
    if (!parsed) {
      return NextResponse.json(
        { error: "Некоректні позиції КП (quoteItems)" },
        { status: 400 },
      );
    }
    snapshotJson = rebuildProposalSnapshotV3({
      previousSnapshot: row.snapshotJson,
      estimate: {
        id: row.estimate.id,
        version: row.estimate.version,
        totalPrice: row.estimate.totalPrice,
        discountAmount: row.estimate.discountAmount,
        deliveryCost: row.estimate.deliveryCost,
        installationCost: row.estimate.installationCost,
        notes: row.estimate.notes,
        lineItems: row.estimate.lineItems.map((li) => ({
          id: li.id,
          type: li.type,
          category: li.category,
          productName: li.productName,
          qty: li.qty,
          unit: li.unit,
          salePrice: li.salePrice,
          amountSale: li.amountSale,
          metadataJson: li.metadataJson ?? undefined,
        })),
      },
      quoteItems: parsed,
    }) as unknown as typeof row.snapshotJson;
  }

  const canVis = prismaCodegenIncludesLeadProposalVisualizationUrl();
  const visUrl =
    typeof body.visualizationUrl === "string"
      ? body.visualizationUrl.trim().slice(0, 2048) || null
      : undefined;

  await prisma.leadProposal.update({
    where: { id: row.id },
    data: {
      status,
      sentAt:
        status === "SENT"
          ? body.markSent
            ? new Date()
            : (row.sentAt ?? new Date())
          : row.sentAt,
      ...(body.title !== undefined ? { title: body.title } : {}),
      ...(body.summary !== undefined ? { summary: body.summary } : {}),
      ...(body.quoteItems !== undefined ? { snapshotJson } : {}),
      ...(canVis && visUrl !== undefined ? { visualizationUrl: visUrl } : {}),
    },
  });

  revalidatePath(`/leads/${leadId}`);
  revalidatePath(`/leads/${leadId}/pricing`);
  revalidatePath(`/leads/${leadId}/proposals/${proposalId}/edit`);

  return NextResponse.json({ ok: true });
}
