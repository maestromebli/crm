import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { hashShareToken, mapContractDetails } from "@/lib/contracts/service";
import { ContractStatusBadge } from "@/features/contracts/components/ContractStatusBadge";
import { ContractPreview } from "@/features/contracts/components/ContractPreview";
import { PortalViewedPing } from "@/features/contracts/components/PortalViewedPing";
import { SignWithDiiaButton } from "@/features/contracts/components/SignWithDiiaButton";

type Props = { params: Promise<{ token: string }> };

export default async function PortalContractPage({ params }: Props) {
  const { token } = await params;
  const share = await (prisma as any).contractShareLink.findUnique({
    where: { tokenHash: hashShareToken(token) },
    include: { contract: true },
  });
  if (!share || share.status !== "ACTIVE" || share.expiresAt < new Date()) {
    notFound();
  }

  const vm = mapContractDetails(share.contract);

  return (
    <main className="mx-auto max-w-6xl space-y-4 p-4">
      <PortalViewedPing token={token} />
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Договір №{vm.preview.contractNumber || vm.id}</h1>
          <p className="text-sm text-slate-500">Клієнтський портал</p>
        </div>
        <ContractStatusBadge status={vm.status} />
      </header>
      <ContractPreview contract={vm} />
      <SignWithDiiaButton token={token} />
    </main>
  );
}
