"use client";

import { useState } from "react";

type IntegrationConnectionTestProps = {
  endpoint: string;
  title?: string;
  formatSuccessMessage?: (payload: Record<string, unknown>) => string;
};

type TestState = "idle" | "loading" | "success" | "error";

export function IntegrationConnectionTest({
  endpoint,
  title = "Перевірка з'єднання",
  formatSuccessMessage,
}: IntegrationConnectionTestProps) {
  const [state, setState] = useState<TestState>("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function runTest() {
    setState("loading");
    setMessage(null);
    try {
      const res = await fetch(endpoint, { method: "GET", credentials: "same-origin" });
      const payload = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok) {
        const errorMessage =
          typeof payload.error === "string"
            ? payload.error
            : `Помилка HTTP ${res.status}`;
        throw new Error(errorMessage);
      }
      const successMessage = formatSuccessMessage
        ? formatSuccessMessage(payload)
        : "Підключення працює коректно.";
      setState("success");
      setMessage(successMessage);
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Тест підключення не пройшов");
    }
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-[var(--enver-card)] p-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-medium text-slate-700">{title}</p>
        <button
          type="button"
          onClick={() => void runTest()}
          disabled={state === "loading"}
          className="rounded-full border border-slate-300 px-2.5 py-1 text-[10px] font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-60"
        >
          {state === "loading" ? "Перевіряємо..." : "Перевірити"}
        </button>
      </div>
      {message ? (
        <p
          className={
            state === "success"
              ? "mt-1 text-[10px] text-emerald-700"
              : "mt-1 text-[10px] text-rose-700"
          }
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
