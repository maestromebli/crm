import { NextResponse } from "next/server";
import { ensureLeadProposalFirstViewRecorded } from "../../../../../lib/leads/mark-proposal-first-view";
import { parseProposalSnapshot } from "../../../../../lib/leads/proposal-snapshot";
import { prisma } from "../../../../../lib/prisma";

type Ctx = { params: Promise<{ token: string }> };

/**
 * Публічні дані КП за токеном (без авторизації). Перегляд фіксує `viewedAt` один раз.
 */
export async function GET(_req: Request, ctx: Ctx) {
  if (!process.env.DATABASE_URL?.trim()) {
    return NextResponse.json(
      { error: "Недоступно" },
      { status: 503 },
    );
  }

  const { token } = await ctx.params;
  if (!token?.trim()) {
    return NextResponse.json({ error: "Некоректний токен" }, { status: 400 });
  }

  const proposal = await prisma.leadProposal.findFirst({
    where: { publicToken: token.trim() },
    include: {
      lead: { select: { title: true } },
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
    return NextResponse.json({ error: "Не знайдено" }, { status: 404 });
  }

  await ensureLeadProposalFirstViewRecorded({
    id: proposal.id,
    status: proposal.status,
    viewedAt: (proposal as { viewedAt?: Date | null }).viewedAt,
  });

  const est = proposal.estimate;
  const snap = parseProposalSnapshot(proposal.snapshotJson);

  const flatLines =
    snap?.schema === "lead_proposal_snapshot_v3"
      ? snap.sourceLineItems
      : snap?.lineItems;

  return NextResponse.json({
    leadTitle: proposal.lead.title,
    proposalVersion: proposal.version,
    status: proposal.status,
    estimateVersion: snap?.estimateVersion ?? est?.version ?? null,
    total: snap?.total ?? est?.totalPrice ?? null,
    currency: snap?.currency ?? "UAH",
    lines: flatLines
      ? flatLines.map((li) => ({
          name: li.productName,
          qty: li.qty,
          unit: li.unit,
          amount: li.amountSale,
        }))
      : (est?.lineItems.map((li) => ({
          name: li.productName,
          qty: li.qty,
          unit: li.unit,
          amount: li.amountSale,
        })) ?? []),
    summary: proposal.summary ?? proposal.notes ?? snap?.notes ?? null,
    title: proposal.title,
    snapshotCapturedAt: snap?.capturedAt ?? null,
  });
}
