"use client";

import { useState } from "react";
import { contractsApi } from "../../lib/contracts-api";

export function ShareContractDialog({ contractId }: { contractId: string }) {
  const [expiresInHours, setExpiresInHours] = useState("72");
  const [maxViews, setMaxViews] = useState("10");
  const [result, setResult] = useState<string | null>(null);

  async function onShare() {
    const response = (await contractsApi.share(contractId, {
      expiresInHours: Number(expiresInHours),
      maxViews: Number(maxViews)
    })) as { token: string };
    const urlBase = typeof window !== "undefined" ? window.location.origin : "";
    setResult(`${urlBase}/portal/contracts/${response.token}`);
  }

  return (
    <div className="rounded-xl border bg-white p-4">
      <h3 className="text-base font-semibold">Надіслати клієнту</h3>
      <div className="mt-3 grid gap-2 md:grid-cols-2">
        <label className="text-sm">
          <span className="text-slate-600">Живе (год)</span>
          <input
            value={expiresInHours}
            onChange={(e) => setExpiresInHours(e.target.value)}
            className="mt-1 w-full rounded-md border px-3 py-2"
          />
        </label>
        <label className="text-sm">
          <span className="text-slate-600">Макс. переглядів</span>
          <input
            value={maxViews}
            onChange={(e) => setMaxViews(e.target.value)}
            className="mt-1 w-full rounded-md border px-3 py-2"
          />
        </label>
      </div>
      <button className="mt-3 rounded-md bg-indigo-600 px-4 py-2 text-sm text-white" onClick={onShare}>
        Згенерувати посилання
      </button>
      {result ? <p className="mt-2 break-all text-sm text-slate-700">{result}</p> : null}
    </div>
  );
}
