import Link from "next/link";
import { ContractPreview } from "../../../../components/contracts/ContractPreview";
import { ContractStatusBadge } from "../../../../components/contracts/ContractStatusBadge";
import { ShareContractDialog } from "../../../../components/contracts/ShareContractDialog";
import { contractsApi } from "../../../../lib/contracts-api";
import { ContractEntity } from "../../../../components/contracts/types";

export default async function ManagerContractPage({ params }: { params: { id: string } }) {
  const contract = (await contractsApi.getContract(params.id)) as ContractEntity;

  return (
    <main className="mx-auto max-w-6xl space-y-4 p-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Договір №{contract.contractNumber}</h1>
          <p className="text-sm text-slate-600">Менеджерська картка договору</p>
        </div>
        <ContractStatusBadge status={contract.status} />
      </header>

      <div className="flex flex-wrap gap-2">
        <Link href={`/manager/contracts/${contract.id}/edit`} className="rounded-md border px-3 py-2 text-sm">
          Редагувати
        </Link>
        <Link
          href={`/manager/contracts/${contract.id}/review`}
          className="rounded-md bg-slate-900 px-3 py-2 text-sm text-white"
        >
          Рев'ю та відправка
        </Link>
      </div>

      <ContractPreview contract={contract} />
      <ShareContractDialog contractId={contract.id} />
    </main>
  );
}
