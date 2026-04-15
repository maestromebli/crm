import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { verifyClientPortalToken } from "@/lib/client-portal/token";
import { ClientPortalView } from "./view";

type Props = { params: Promise<{ token: string }> };

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Клієнтський портал · ENVER",
    robots: { index: false, follow: false },
  };
}

export default async function ClientPortalPage({ params }: Props) {
  const { token } = await params;
  const verified = verifyClientPortalToken(token);
  if (!verified) notFound();

  const deal = await prisma.deal.findUnique({
    where: { id: verified.dealId },
    include: {
      client: { select: { name: true } },
      stage: { select: { name: true } },
      contract: { select: { status: true } },
      invoices: { orderBy: { createdAt: "desc" }, take: 10 },
      moneyTransactions: {
        where: { type: "INCOME" },
        orderBy: { paidAt: "desc" },
        take: 20,
      },
      stageHistory: {
        include: { toStage: { select: { name: true } } },
        orderBy: { changedAt: "desc" },
        take: 30,
      },
    },
  });
  if (!deal) notFound();

  const docs = await prisma.attachment.findMany({
    where: {
      entityType: "DEAL",
      entityId: deal.id,
      deletedAt: null,
      category: { in: ["QUOTE_PDF", "CONTRACT", "DRAWING", "SPEC"] },
    },
    orderBy: { createdAt: "desc" },
    take: 40,
    select: {
      id: true,
      fileName: true,
      category: true,
      createdAt: true,
    },
  });

  return (
    <ClientPortalView
      token={token}
      payload={{
        dealId: deal.id,
        title: deal.title,
        clientName: deal.client.name,
        stageName: deal.stage.name,
        contractStatus: deal.contract?.status ?? null,
        installationDate: deal.installationDate?.toISOString() ?? null,
        expectedCloseDate: deal.expectedCloseDate?.toISOString() ?? null,
        docs: docs.map((d) => ({
          id: d.id,
          fileName: d.fileName,
          category: d.category,
          createdAt: d.createdAt.toISOString(),
        })),
        invoices: deal.invoices.map((i) => ({
          id: i.id,
          amount: Number(i.amount),
          status: i.status,
          type: i.type,
          createdAt: i.createdAt.toISOString(),
        })),
        transactions: deal.moneyTransactions.map((t) => ({
          id: t.id,
          amount: Number(t.amount),
          currency: t.currency,
          paidAt: t.paidAt?.toISOString() ?? null,
          category: t.category,
          status: t.status,
        })),
        timeline: deal.stageHistory.map((h) => ({
          id: h.id,
          at: h.changedAt.toISOString(),
          stageName: h.toStage.name,
        })),
      }}
    />
  );
}
