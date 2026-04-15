import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { mapContractDetails } from "@/lib/contracts/service";
import { ContractPreview } from "@/features/contracts/components/ContractPreview";
import { ManagerReviewActions } from "@/features/contracts/components/ManagerReviewActions";
import { AuditTimeline } from "@/features/contracts/components/AuditTimeline";

type Props = { params: Promise<{ id: string }> };

export default async function ReviewContractPage({ params }: Props) {
  const { id } = await params;
  const contract = await prisma.dealContract.findUnique({ where: { id } });
  if (!contract) notFound();
  const logs = await prisma.activityLog.findMany({
    where: {
      entityType: "DEAL",
      entityId: contract.dealId,
      type: { in: ["CONTRACT_STATUS_CHANGED", "CONTRACT_CREATED"] },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      type: true,
      actorUserId: true,
      source: true,
      data: true,
      createdAt: true,
    },
  });

  const vm = {
    ...mapContractDetails(contract),
    audit: logs.map((row) => ({
      id: row.id,
      action: row.type,
      actorUserId: row.actorUserId,
      source: row.source,
      payload: row.data,
      createdAt: row.createdAt.toISOString(),
    })),
  };

  return (
    <main className="mx-auto max-w-6xl space-y-4 p-4">
      <h1 className="text-2xl font-semibold text-slate-900">Review договору</h1>
      <ManagerReviewActions contractId={vm.id} />
      <ContractPreview contract={vm} />
      <AuditTimeline contract={vm} />
    </main>
  );
}
