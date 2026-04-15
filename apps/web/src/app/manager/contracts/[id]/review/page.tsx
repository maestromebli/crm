import { AuditTimeline } from "../../../../../components/contracts/AuditTimeline";
import { ContractPreview } from "../../../../../components/contracts/ContractPreview";
import { ManagerReviewActions } from "../../../../../components/contracts/ManagerReviewActions";
import { contractsApi } from "../../../../../lib/contracts-api";
import { ContractEntity } from "../../../../../components/contracts/types";

export default async function ReviewContractPage({ params }: { params: { id: string } }) {
  const contract = (await contractsApi.getContract(params.id)) as ContractEntity;
  return (
    <main className="mx-auto max-w-6xl space-y-4 p-6">
      <h1 className="text-2xl font-semibold">Review договору №{contract.contractNumber}</h1>
      <ManagerReviewActions contractId={contract.id} />
      <ContractPreview contract={contract} />
      <AuditTimeline contract={contract} />
    </main>
  );
}
