import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { mapContractDetails } from "@/lib/contracts/service";
import { ContractStatusBadge } from "@/features/contracts/components/ContractStatusBadge";
import { ContractPreview } from "@/features/contracts/components/ContractPreview";
import { ShareContractDialog } from "@/features/contracts/components/ShareContractDialog";

type Props = { params: Promise<{ id: string }> };

export default async function ManagerContractPage({ params }: Props) {
  const { id } = await params;
  const contract = await prisma.dealContract.findUnique({ where: { id } });
  if (!contract) notFound();
  const vm = mapContractDetails(contract);

  return (
    <main className="mx-auto max-w-6xl space-y-4 p-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Договір №{vm.preview.contractNumber || vm.id}</h1>
          <p className="text-sm text-slate-500">Менеджерська картка договору</p>
        </div>
        <ContractStatusBadge status={vm.status} />
      </header>
      <div className="flex gap-2">
        <Link href={`/manager/contracts/${vm.id}/edit`} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
          Редагувати
        </Link>
        <Link href={`/manager/contracts/${vm.id}/review`} className="rounded-lg bg-slate-900 px-3 py-2 text-sm text-white">
          Review
        </Link>
      </div>
      <ContractPreview contract={vm} />
      <ShareContractDialog contractId={vm.id} />
    </main>
  );
}
