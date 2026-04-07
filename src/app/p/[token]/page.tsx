import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ensureLeadProposalFirstViewRecorded } from "../../../lib/leads/mark-proposal-first-view";
import { buildQuotePrintModelFromEntities } from "../../../lib/leads/lead-proposal-document";
import { LeadProposalDocumentView } from "../../../modules/leads/lead-proposal/LeadProposalDocumentView";
import { prisma } from "../../../lib/prisma";

type PageProps = { params: Promise<{ token: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { token } = await params;
  return {
    title: "Комерційна пропозиція",
    robots: { index: false, follow: false },
    openGraph: { title: `КП · ${token.slice(0, 8)}…` },
  };
}

export default async function PublicProposalPage({ params }: PageProps) {
  const { token } = await params;
  if (!token?.trim()) notFound();

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

  if (!proposal) notFound();

  const visual = await prisma.attachment.findFirst({
    where: {
      entityType: "LEAD",
      entityId: proposal.leadId,
      category: { in: ["OBJECT_PHOTO", "REFERENCE", "RESULT_PHOTO"] },
      deletedAt: null,
      mimeType: { startsWith: "image/" },
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, fileUrl: true },
  });

  await ensureLeadProposalFirstViewRecorded({
    id: proposal.id,
    status: proposal.status,
    viewedAt: (proposal as { viewedAt?: Date | null }).viewedAt,
  });

  const est = proposal.estimate;
  const fromAttachment =
    visual?.id && token.trim()
      ? `/api/p/${encodeURIComponent(token.trim())}/attachment/${visual.id}`
      : visual?.fileUrl ?? null;

  const model = buildQuotePrintModelFromEntities({
    leadTitle: proposal.lead.title,
    fallbackImageUrl: fromAttachment,
    proposal: {
      title: proposal.title,
      version: proposal.version,
      createdAt: proposal.createdAt,
      summary: proposal.summary,
      notes: proposal.notes,
      snapshotJson: proposal.snapshotJson,
      visualizationUrl: proposal.visualizationUrl,
    },
    estimate: est
      ? {
          name: est.name,
          templateKey: est.templateKey,
          version: est.version,
          totalPrice: est.totalPrice,
          discountAmount: est.discountAmount,
          deliveryCost: est.deliveryCost,
          installationCost: est.installationCost,
          lineItems: est.lineItems.map((li) => ({
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
        }
      : null,
  });

  return (
    <div className="min-h-screen bg-[var(--enver-bg)] px-4 py-10 text-[var(--enver-text)] print:bg-white print:py-4">
      <LeadProposalDocumentView model={model} />
    </div>
  );
}
