"use client";

import { useState } from "react";

export function SignWithDiiaButton({ token }: { token: string }) {
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isError, setIsError] = useState(false);

  async function sign() {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setMessage("");
    setIsError(false);
    try {
      const res = await fetch(`/api/portal/contracts/${token}/sign`, { method: "POST" });
      const payload = (await res.json()) as {
        data?: { signingUrl?: string; provider?: string };
        error?: string;
      };
      if (!res.ok) {
        setIsError(true);
        setMessage(payload.error ?? "Не вдалося запустити підпис.");
        return;
      }
      if (payload.data?.signingUrl) {
        setMessage(
          `Сесію підписання створено (${payload.data.provider ?? "provider"}). Відкрийте посилання: ${payload.data.signingUrl}`,
        );
      } else {
        setMessage("Сесію підписання створено.");
      }
    } catch {
      setIsError(true);
      setMessage("Сервіс підпису тимчасово недоступний. Спробуйте ще раз.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-2 rounded-xl border border-violet-200 bg-violet-50 p-4">
      <button
        type="button"
        onClick={() => void sign()}
        disabled={isSubmitting}
        aria-busy={isSubmitting}
        className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? "Створюємо сесію..." : "Підписати через Дія"}
      </button>
      {message ? (
        <p
          role="status"
          aria-live="polite"
          className={isError ? "text-sm text-rose-700" : "text-sm text-slate-700"}
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
