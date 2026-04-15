"use client";

import { useState } from "react";
import { contractsApi } from "../../lib/contracts-api";

export function SignWithDiiaButton({ token }: { token: string }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function onSign() {
    setLoading(true);
    setMessage(null);
    try {
      const session = (await contractsApi.signPortal(token)) as { signingUrl?: string };
      setMessage(`Сесію створено. Перейдіть: ${session.signingUrl}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не вдалося створити сесію підпису");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-lg border border-violet-200 bg-violet-50 p-4">
      <button
        onClick={onSign}
        disabled={loading}
        className="rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
      >
        {loading ? "Створення..." : "Підписати через Дія"}
      </button>
      {message ? <p className="mt-2 text-sm text-slate-700">{message}</p> : null}
    </div>
  );
}
