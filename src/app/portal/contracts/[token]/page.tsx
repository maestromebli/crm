import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { hashShareToken, mapContractDetails } from "@/lib/contracts/service";
import { ContractStatusBadge } from "@/features/contracts/components/contract-status-badge";

type Props = { params: Promise<{ token: string }> };

export default async function PortalContractPage({ params }: Props) {
  const { token } = await params;
  const share = await (prisma as any).dealContractShareLink.findUnique({
    where: { tokenHash: hashShareToken(token) },
    include: { contract: true },
  });
  if (!share || share.status !== "ACTIVE" || share.expiresAt < new Date()) {
    notFound();
  }

  const vm = mapContractDetails(share.contract);

  return (
    <main className="mx-auto max-w-4xl space-y-4 p-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            Договір №{vm.preview.contractNumber || vm.id}
          </h1>
          <p className="text-sm text-slate-500">Клієнтський портал</p>
        </div>
        <ContractStatusBadge status={String(vm.rawStatus)} />
      </header>

      <section className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
        <p>
          Клієнт: <span className="font-medium">{vm.preview.customerFullName || "—"}</span>
        </p>
        <p>
          Сума: <span className="font-medium">{vm.preview.totalAmountFormatted}</span>
        </p>
      </section>
    </main>
  );
}
