import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { mapContractDetails } from "@/lib/contracts/service";
import { ContractForm } from "@/features/contracts/components/ContractForm";

type Props = { params: Promise<{ id: string }> };

export default async function EditContractPage({ params }: Props) {
  const { id } = await params;
  const contract = await prisma.dealContract.findUnique({ where: { id } });
  if (!contract) notFound();
  const vm = mapContractDetails(contract);

  return (
    <main className="mx-auto max-w-6xl space-y-4 p-4">
      <h1 className="text-2xl font-semibold text-slate-900">Редагування договору</h1>
      <ContractForm contract={vm} />
    </main>
  );
}
