"use client";

import { useState } from "react";

export function ManagerReviewActions({ contractId }: { contractId: string }) {
  const [message, setMessage] = useState("");

  async function run(url: string) {
    setMessage("Виконання...");
    const res = await fetch(url, { method: "POST" });
    const payload = (await res.json()) as { error?: string };
    if (!res.ok) {
      setMessage(payload.error ?? "Помилка");
      return;
    }
    setMessage("Готово");
  }

  return (
    <div className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4">
      <h3 className="text-base font-semibold">Дії ревʼю</h3>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void run(`/api/contracts/${contractId}/generate-documents`)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          Згенерувати документи
        </button>
        <button
          type="button"
          onClick={() => void run(`/api/contracts/${contractId}/send-for-review`)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          Надіслати на перевірку
        </button>
        <button
          type="button"
          onClick={() => void run(`/api/contracts/${contractId}/approve`)}
          className="rounded-lg bg-emerald-600 px-3 py-2 text-sm text-white"
        >
          Погодити
        </button>
      </div>
      {message ? <p className="text-sm text-slate-600">{message}</p> : null}
    </div>
  );
}
