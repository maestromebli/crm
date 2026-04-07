"use client";

import { useState } from "react";

export function GitLabIntegrationTest() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function runTest() {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/integrations/gitlab", { cache: "no-store" });
      const j = (await res.json()) as
        | {
            ok: true;
            baseUrl: string;
            gitlabVersion: string;
            user: { id: number; username: string; name: string };
          }
        | { ok: false; error?: string; httpStatus?: number };
      if (!res.ok) {
        setMessage(`Помилка запиту (${res.status})`);
        return;
      }
      if (j.ok) {
        setMessage(
          `З’єднання OK · GitLab ${j.gitlabVersion} · користувач @${j.user.username} (${j.user.name}) · ${j.baseUrl}`,
        );
      } else {
        setMessage(
          "error" in j && j.error ? j.error : "Помилка перевірки",
        );
      }
    } catch {
      setMessage("Мережева помилка");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => void runTest()}
        disabled={loading}
        className="rounded-lg border border-slate-900 bg-slate-900 px-3 py-1.5 text-[11px] font-medium text-white shadow-sm hover:bg-slate-800 disabled:opacity-60"
      >
        {loading ? "Перевірка…" : "Перевірити з’єднання"}
      </button>
      {message ? (
        <p className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-[11px] text-slate-700">
          {message}
        </p>
      ) : null}
    </div>
  );
}
