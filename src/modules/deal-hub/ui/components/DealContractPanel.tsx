"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { DealCard } from "./_shared";

export function DealContractPanel() {
  const pathname = usePathname();
  const dealId = useMemo(() => {
    const m = pathname.match(/\/deals\/([^/]+)/);
    return m?.[1] ?? null;
  }, [pathname]);
  const [contractId, setContractId] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("—");

  useEffect(() => {
    if (!dealId) return;
    let mounted = true;
    void fetch(`/api/deals/${dealId}/documents`, { cache: "no-store" })
      .then((res) => res.json())
      .then((json) => {
        if (!mounted) return;
        const row = (json?.data?.contract ?? null) as { id?: string; status?: string } | null;
        setContractId(row?.id ?? null);
        setStatus(row?.status ?? "—");
      })
      .catch(() => {
        if (!mounted) return;
        setContractId(null);
        setStatus("—");
      });
    return () => {
      mounted = false;
    };
  }, [dealId]);

  return (
    <DealCard title="Договір" subtitle="Модуль договорів ENVER">
      <div className="space-y-2 text-sm">
        <p className="text-slate-600">Поточний статус: {status}</p>
        {contractId ? (
          <Link href={`/deals/${dealId}/workspace?tab=contract`} className="inline-flex rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white">
            Відкрити модуль договорів
          </Link>
        ) : (
          <p className="text-xs text-slate-500">Створіть договір через API `POST /api/contracts`.</p>
        )}
      </div>
    </DealCard>
  );
}
