import { ContractStatusBadge } from "./contract-status-badge";

type Props = {
  contract: {
    id: string;
    contractNumber: string;
    templateVersion: number;
    status: string;
    signatureStatus: string;
    provider?: string | null;
    signedAt?: string | Date | null;
    renderedPdfUrl?: string | null;
  } | null;
  onAction?: (action: string, contractId: string) => void;
};

export function ContractSummaryCard({ contract, onAction }: Props) {
  if (!contract) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
        Договір ще не створено.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-base font-semibold text-slate-900">{contract.contractNumber}</div>
          <p className="text-xs text-slate-500">Шаблон v{contract.templateVersion}</p>
        </div>
        <ContractStatusBadge
          status={contract.status}
          signatureStatus={contract.signatureStatus}
        />
      </div>
      <div className="mt-3 grid gap-1 text-xs text-slate-600">
        <div>Провайдер підпису: {contract.provider ?? "—"}</div>
        <div>
          Дата підписання:{" "}
          {contract.signedAt ? new Date(contract.signedAt).toLocaleString("uk-UA") : "—"}
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs"
          onClick={() => onAction?.("issue", contract.id)}
          type="button"
        >
          Випустити
        </button>
        <button
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs"
          onClick={() => onAction?.("send", contract.id)}
          type="button"
        >
          Надіслати на підпис
        </button>
        {contract.renderedPdfUrl ? (
          <a
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs"
            href={contract.renderedPdfUrl}
            target="_blank"
          >
            PDF
          </a>
        ) : null}
      </div>
    </div>
  );
}
