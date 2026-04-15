import { ContractForm } from "../../../../../components/contracts/ContractForm";
import { contractsApi } from "../../../../../lib/contracts-api";
import { ContractEntity } from "../../../../../components/contracts/types";

export default async function EditContractPage({ params }: { params: { id: string } }) {
  const contract = (await contractsApi.getContract(params.id)) as ContractEntity;

  return (
    <main className="mx-auto max-w-5xl space-y-4 p-6">
      <h1 className="text-2xl font-semibold">Редагування договору №{contract.contractNumber}</h1>
      <ContractForm contract={contract} />
    </main>
  );
}
