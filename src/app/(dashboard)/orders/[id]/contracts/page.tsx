"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
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

export default function OrderContractsPage() {
  const params = useParams<{ id: string }>();
  const orderId = params.id;
  const [contract, setContract] = useState<Contract | null>(null);

  useEffect(() => {
    if (!orderId) return;
    let mounted = true;
    void fetch(`/api/contracts?orderId=${orderId}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((json: Contract[] | { data?: Contract[] }) => {
        if (!mounted) return;
        const list = Array.isArray(json) ? json : (json.data ?? []);
        setContract(list[0] ?? null);
      })
      .catch(() => {
        if (mounted) setContract(null);
      });
    return () => {
      mounted = false;
    };
  }, [orderId]);

  const gate = useMemo(
    () =>
      computeOrderContractGate({
        contractRequired: true,
        contractStatus: contract?.status as never,
        signatureStatus: contract?.signatureStatus as never,
      }),
    [contract],
  );

  return (
    <main className="mx-auto max-w-5xl space-y-4 p-4">
      <h1 className="text-xl font-semibold text-slate-900">Договір по замовленню</h1>
      <ContractGateBanner gate={gate} />
      <ContractSummaryCard contract={contract} />
    </main>
  );
}
