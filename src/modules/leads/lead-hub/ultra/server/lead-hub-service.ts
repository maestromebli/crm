import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/authz/api-guard";
import { calculatePricing } from "@/modules/leads/lead-pricing/ultra";
import type { PricingItemInput } from "@/modules/leads/lead-pricing/ultra/engine/types";
import { toLeadHubSessionDto } from "../adapters/session-dto";

export async function getLeadHubSession(id: string, user: SessionUser) {
  const session = await prisma.leadHubSession.findUnique({
    where: { id },
    include: {
      pricingSession: {
        include: {
          activeVersion: {
            include: {
              items: true,
            },
          },
        },
      },
      files: {
        include: {
          attachment: true,
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!session) return null;
  return toLeadHubSessionDto(
    { ...session, status: session.status as "DRAFT" | "ACTIVE" | "CONVERTED" | "ARCHIVED" },
    user,
  );
}

export async function createLeadHubSession(params: {
  leadId?: string | null;
  title?: string | null;
  currency?: string;
}) {
  const currency = params.currency?.trim() || "UAH";
  const entityId = params.leadId?.trim() || "unlinked";

  return prisma.$transaction(async (tx) => {
    const pricingSession = await tx.pricingSession.create({
      data: { entityType: "LEAD_HUB", entityId, currency },
    });

    const initial = calculatePricing([
      {
        id: crypto.randomUUID(),
        name: "Base module",
        quantity: 1,
        unitCost: 1000,
        unitPrice: 1400,
        category: "DEFAULT",
      },
    ]);

    const version = await tx.pricingVersion.create({
      data: {
        pricingSessionId: pricingSession.id,
        versionNumber: 1,
        totalsJson: initial.totals,
        summaryJson: initial.summary,
        items: {
          create: initial.items.map((item) => ({
            name: item.name,
            quantity: item.quantity,
            inputJson: {
              unitCost: item.unitCost,
              unitPrice: item.unitPrice,
              category: item.category ?? null,
              note: item.note ?? null,
            },
            resultJson: {
              lineCost: item.lineCost,
              lineRevenue: item.lineRevenue,
              lineMargin: item.lineMargin,
              lineMarginPercent: item.lineMarginPercent,
              warnings: item.warnings,
            },
          })),
        },
      },
    });

    await tx.pricingSession.update({
      where: { id: pricingSession.id },
      data: { activeVersionId: version.id },
    });

    return tx.leadHubSession.create({
      data: {
        title: params.title?.trim() || "Ultra Lead Hub Session",
        status: "DRAFT",
        leadId: params.leadId ?? null,
        pricingSessionId: pricingSession.id,
      },
    });
  });
}

export async function updatePricingFromState(params: {
  pricingSessionId: string;
  items: PricingItemInput[];
  summaryNote?: string;
}) {
  const pricingSession = await prisma.pricingSession.findUnique({
    where: { id: params.pricingSessionId },
    include: { activeVersion: { select: { versionNumber: true } } },
  });
  if (!pricingSession) throw new Error("Pricing session not found");

  const calculated = calculatePricing(params.items);
  const nextVersionNumber = (pricingSession.activeVersion?.versionNumber ?? 0) + 1;

  const createdVersion = await prisma.pricingVersion.create({
    data: {
      pricingSessionId: pricingSession.id,
      versionNumber: nextVersionNumber,
      totalsJson: calculated.totals,
      summaryJson: { ...calculated.summary, summaryNote: params.summaryNote ?? null },
      items: {
        create: calculated.items.map((item) => ({
          name: item.name,
          quantity: item.quantity,
          inputJson: {
            unitCost: item.unitCost,
            unitPrice: item.unitPrice,
            category: item.category ?? null,
            note: item.note ?? null,
          },
          resultJson: {
            lineCost: item.lineCost,
            lineRevenue: item.lineRevenue,
            lineMargin: item.lineMargin,
            lineMarginPercent: item.lineMarginPercent,
            warnings: item.warnings,
          },
        })),
      },
    },
  });

  await prisma.pricingSession.update({
    where: { id: pricingSession.id },
    data: { activeVersionId: createdVersion.id },
  });
  return createdVersion;
}

export async function convertLeadHubToDeal(params: {
  sessionId: string;
  dealTitle?: string;
  pipelineId: string;
  stageId: string;
  clientId: string;
  ownerId: string;
}) {
  return prisma.$transaction(async (tx) => {
    const session = await tx.leadHubSession.findUnique({
      where: { id: params.sessionId },
      include: { pricingSession: { include: { activeVersion: true } } },
    });
    if (!session) throw new Error("Lead hub session not found");

    const totalRevenue = Number(
      ((session.pricingSession.activeVersion?.totalsJson ?? {}) as { totalRevenue?: number })
        .totalRevenue ?? 0,
    );

    const deal = await tx.deal.create({
      data: {
        title: params.dealTitle?.trim() || session.title || "Deal from Lead Hub",
        description: "Auto-converted from pricing-first Lead Hub",
        status: "OPEN",
        pipelineId: params.pipelineId,
        stageId: params.stageId,
        clientId: params.clientId,
        ownerId: params.ownerId,
        value: totalRevenue,
        currency: session.pricingSession.currency,
      },
    });

    await tx.leadHubSession.update({
      where: { id: session.id },
      data: { status: "CONVERTED" },
    });
    return deal;
  });
}
