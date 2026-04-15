"use client";

import { useState } from "react";

export function ShareContractDialog({ contractId }: { contractId: string }) {
  const [expiresInHours, setExpiresInHours] = useState(72);
  const [maxViews, setMaxViews] = useState(10);
  const [link, setLink] = useState("");
  const [error, setError] = useState("");

  async function share() {
    setError("");
    const res = await fetch(`/api/contracts/${contractId}/share`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expiresInHours, maxViews }),
    });
    const payload = (await res.json()) as { data?: { portalUrl?: string }; error?: string };
    if (!res.ok) {
      setError(payload.error ?? "Помилка");
      return;
    }
    const portalUrl = payload.data?.portalUrl ?? "";
    setLink(`${window.location.origin}${portalUrl}`);
  }

  return (
    <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
      <h3 className="text-base font-semibold">Поділитися з клієнтом</h3>
      <div className="grid grid-cols-2 gap-3">
        <label className="space-y-1 text-sm">
          <span className="text-slate-600">Термін (год)</span>
          <input
            type="number"
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
            value={expiresInHours}
            onChange={(e) => setExpiresInHours(Number(e.target.value))}
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-slate-600">Макс. переглядів</span>
          <input
            type="number"
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
            value={maxViews}
            onChange={(e) => setMaxViews(Number(e.target.value))}
          />
        </label>
      </div>
      <button type="button" onClick={() => void share()} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white">
        Згенерувати лінк
      </button>
      {link ? (
        <div className="rounded-lg bg-slate-50 p-2 text-sm">
          <p className="break-all">{link}</p>
        </div>
      ) : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </section>
  );
}
