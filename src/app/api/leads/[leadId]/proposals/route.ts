import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import {
  forbidUnlessLeadAccess,
  forbidUnlessPermission,
  requireSessionUser,
} from "../../../../../lib/authz/api-guard";
import { P } from "../../../../../lib/authz/permissions";
import {
  prisma,
  prismaCodegenIncludesEstimateLeadId,
  prismaCodegenIncludesLeadProposalVisualizationUrl,
} from "../../../../../lib/prisma";
import {
  applyVisualizationUrlsToQuoteSnapshot,
  buildProposalSnapshotV3FromEstimate,
} from "../../../../../lib/leads/proposal-snapshot";

type Ctx = { params: Promise<{ leadId: string }> };

function formatProposalTotal(total: number | null | undefined): string | null {
  if (typeof total !== "number" || !Number.isFinite(total)) return null;
  return `${new Intl.NumberFormat("uk-UA", {
    maximumFractionDigits: total % 1 === 0 ? 0 : 2,
  }).format(total)} грн`;
}

function buildProposalTitleFromEstimate(
  estimateName: string,
  totalPrice: number | null | undefined,
  version: number,
): string {
  const name = estimateName.trim() || "Розрахунок";
  const totalLabel = formatProposalTotal(totalPrice);
  return totalLabel
    ? `${name} · КП v${version} · ${totalLabel}`
    : `${name} · КП v${version}`;
}

/**
 * Створити нову версію КП на ліді, привʼязану до знімка смети (estimateId).
 */
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

  if (!prismaCodegenIncludesEstimateLeadId()) {
    return NextResponse.json(
      { error: "КП по ліду недоступні" },
      { status: 503 },
    );
  }

  const { leadId } = await ctx.params;

  let body: {
    estimateId?: string;
    title?: string | null;
    notes?: string | null;
    summary?: string | null;
    visualizationUrl?: string | null;
    visualizationUrls?: unknown;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    body = {};
  }
  const estimateId =
    typeof body.estimateId === "string" ? body.estimateId.trim() : "";
  const proposalTitle =
    typeof body.title === "string" && body.title.trim()
      ? body.title.trim().slice(0, 200)
      : null;
  const proposalNotes =
    typeof body.notes === "string"
      ? body.notes.trim().slice(0, 4000) || null
      : null;
  const proposalSummary =
    typeof body.summary === "string"
      ? body.summary.trim().slice(0, 2000) || null
      : null;
  const legacyViz =
    typeof body.visualizationUrl === "string" &&
    body.visualizationUrl.trim().length > 0
      ? body.visualizationUrl.trim().slice(0, 2048)
      : null;

  let mergedVisualizationUrls: string[] = [];
  if (Array.isArray(body.visualizationUrls) && body.visualizationUrls.length > 0) {
    mergedVisualizationUrls = body.visualizationUrls.map((x) =>
      typeof x === "string" ? x.trim().slice(0, 2048) : "",
    );
  } else if (legacyViz) {
    mergedVisualizationUrls = [legacyViz];
  }

  const proposalVisualizationUrl =
    mergedVisualizationUrls.find((u) => u.length > 0) ?? null;

  if (!estimateId) {
    return NextResponse.json(
      { error: "Потрібен estimateId" },
      { status: 400 },
    );
  }

  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: {
      id: true,
      title: true,
      ownerId: true,
      dealId: true,
      activeProposalId: true,
    },
  });
  if (!lead) {
    return NextResponse.json({ error: "Лід не знайдено" }, { status: 404 });
  }
  if (lead.dealId) {
    return NextResponse.json(
      { error: "Лід уже в угоді — КП ведуться в угоді" },
      { status: 409 },
    );
  }

  const denied = await forbidUnlessLeadAccess(user, P.LEADS_UPDATE, lead);
  if (denied) return denied;

  const estimateFull = await prisma.estimate.findFirst({
    where: { id: estimateId, leadId },
    include: {
        lineItems: {
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        },
      },
  });
  if (!estimateFull) {
    return NextResponse.json(
      { error: "Смета не знайдена або не належить цьому ліду" },
      { status: 404 },
    );
  }

  let snapshotJson = buildProposalSnapshotV3FromEstimate({
    id: estimateFull.id,
    version: estimateFull.version,
    name: estimateFull.name,
    templateKey: estimateFull.templateKey,
    totalPrice: estimateFull.totalPrice,
    discountAmount: estimateFull.discountAmount,
    deliveryCost: estimateFull.deliveryCost,
    installationCost: estimateFull.installationCost,
    notes: estimateFull.notes,
    lineItems: estimateFull.lineItems.map((li) => ({
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
  });

  if (mergedVisualizationUrls.some((u) => u.length > 0)) {
    snapshotJson = applyVisualizationUrlsToQuoteSnapshot(
      snapshotJson,
      mergedVisualizationUrls,
    );
  }

  const canPersistVisualizationUrl =
    prismaCodegenIncludesLeadProposalVisualizationUrl() &&
    proposalVisualizationUrl !== null;

  const runCreateTransaction = async (includeVisualizationUrl: boolean) => {
    return prisma.$transaction(async (tx) => {
      const last = await tx.leadProposal.findFirst({
        where: { leadId },
        orderBy: { version: "desc" },
        select: { version: true },
      });
      const nextVersion = (last?.version ?? 0) + 1;

      if (lead.activeProposalId) {
        await tx.leadProposal.updateMany({
          where: {
            id: lead.activeProposalId,
            leadId,
            status: { notIn: ["REJECTED", "SUPERSEDED"] },
          },
          data: { status: "SUPERSEDED" },
        });
      }

      const publicToken = randomBytes(18).toString("base64url").replace(/=/g, "");

      const baseData = {
        leadId,
        estimateId,
        version: nextVersion,
        status: "DRAFT" as const,
        publicToken,
        snapshotJson,
        title:
          proposalTitle ??
          buildProposalTitleFromEstimate(
            estimateFull.name?.trim() || lead.title,
            estimateFull.totalPrice,
            nextVersion,
          ),
        notes: proposalNotes,
        summary: proposalSummary,
        createdById: user.id,
      };

      const proposal = await tx.leadProposal.create({
        data: {
          ...baseData,
          ...(includeVisualizationUrl && proposalVisualizationUrl
            ? { visualizationUrl: proposalVisualizationUrl }
            : {}),
        },
      });

      await tx.lead.update({
        where: { id: leadId },
        data: { activeProposalId: proposal.id },
      });

      return proposal;
    });
  };

  try {
    let created;
    let visualizationDropped = false;
    try {
      created = await runCreateTransaction(canPersistVisualizationUrl);
    } catch (first) {
      const msg = first instanceof Error ? first.message : String(first);
      const looksLikeMissingColumn =
        canPersistVisualizationUrl &&
        (/visualizationUrl/i.test(msg) ||
          (/column/i.test(msg) && /does not exist/i.test(msg)));
      if (looksLikeMissingColumn) {
        created = await runCreateTransaction(false);
        visualizationDropped = true;
      } else {
        throw first;
      }
    }

    revalidatePath(`/leads/${leadId}`);
    revalidatePath(`/leads/${leadId}/pricing`);
    revalidatePath(`/leads/${leadId}/estimate/${estimateId}`);

    return NextResponse.json({
      ok: true,
      proposal: {
        id: created.id,
        version: created.version,
        status: created.status,
        estimateId: created.estimateId,
        publicToken: created.publicToken,
        title: created.title,
      },
      ...(visualizationDropped
        ? {
            warning:
              "Посилання на візуалізацію не збережено: оновіть БД (pnpm prisma db push).",
          }
        : {}),
    });
  } catch (e) {
     
    console.error("[POST leads proposals]", e);
    const msg = e instanceof Error ? e.message : String(e);
    const devHint =
      process.env.NODE_ENV === "development" ? msg.slice(0, 400) : undefined;
    return NextResponse.json(
      {
        error: "Не вдалося створити КП",
        ...(devHint ? { details: devHint } : {}),
      },
      { status: 500 },
    );
  }
}
