"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ContractGateBanner } from "@/features/contracts/components/contract-gate-banner";
import { ContractSummaryCard } from "@/features/contracts/components/contract-summary-card";
import { computeOrderContractGate } from "@/features/contracts/lib/contract-gates";

type Contract = {
  id: string;
  contractNumber: string;
  templateVersion: number;
  status: string;
  signatureStatus: string;
  provider?: string | null;
  signedAt?: string | null;
  renderedPdfUrl?: string | null;
};

export function DealWorkspaceContractTabV2({ dealId }: { dealId: string }) {
  const [contract, setContract] = useState<Contract | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/contracts?dealId=${dealId}`, { cache: "no-store" });
    const rows = (await res.json()) as Contract[];
    setContract(rows[0] ?? null);
  }, [dealId]);

  useEffect(() => {
    void load();
  }, [load]);

  const gate = useMemo(
    () =>
      computeOrderContractGate({
        contractRequired: true,
        contractStatus: contract?.status as never,
        signatureStatus: contract?.signatureStatus as never,
      }),
    [contract],
  );

  const onAction = async (action: string, contractId: string) => {
    setBusy(true);
    try {
      if (action === "issue") {
        await fetch(`/api/contracts/${contractId}/issue`, { method: "POST" });
      } else if (action === "send") {
        await fetch(`/api/contracts/${contractId}/send-for-signature`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ provider: "VCHASNO", deliveryChannels: ["EMAIL"] }),
        });
      }
      await load();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <ContractGateBanner gate={gate} />
      <ContractSummaryCard contract={contract} onAction={onAction} />
      {busy ? <p className="text-xs text-slate-500">Оновлення...</p> : null}
    </div>
  );
}
