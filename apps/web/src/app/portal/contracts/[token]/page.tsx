import { ContractStatusBadge } from "../../../../components/contracts/ContractStatusBadge";
import { SignWithDiiaButton } from "../../../../components/contracts/SignWithDiiaButton";
import { SpecificationTable } from "../../../../components/contracts/SpecificationTable";
import { contractsApi } from "../../../../lib/contracts-api";
import { ContractEntity } from "../../../../components/contracts/types";

export default async function PortalContractPage({ params }: { params: { token: string } }) {
  await contractsApi.markViewed(params.token).catch(() => null);
  const portalData = (await contractsApi.getPortal(params.token)) as { contract: ContractEntity };
  const contract = portalData.contract;

  return (
    <main className="mx-auto max-w-5xl space-y-4 p-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Договір №{contract.contractNumber}</h1>
          <p className="text-sm text-slate-600">Клієнтський портал ENVER</p>
        </div>
        <ContractStatusBadge status={contract.status} />
      </header>

      <section className="rounded-xl border bg-white p-4">
        <h2 className="text-lg font-semibold">Реквізити договору</h2>
        <p className="mt-2 text-sm text-slate-700">Покупець: {contract.customer.fullName}</p>
        <p className="text-sm text-slate-700">Сума: {contract.totalAmount} грн</p>
      </section>

      <SpecificationTable contract={contract} />
      <SignWithDiiaButton token={params.token} />

      <section className="rounded-xl border bg-white p-4">
        <h3 className="text-base font-semibold">Файли</h3>
        <ul className="mt-2 space-y-1 text-sm">
          {(contract.documents ?? []).map((doc: any) => (
            <li key={doc.id}>
              {doc.fileName} - {doc.type}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
