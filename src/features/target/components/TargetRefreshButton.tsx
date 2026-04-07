"use client";

import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function TargetRefreshButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [spin, setSpin] = useState(false);

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        setSpin(true);
        startTransition(() => {
          router.refresh();
        });
        window.setTimeout(() => setSpin(false), 600);
      }}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-[var(--enver-card)] px-3 py-1.5 text-[11px] font-medium text-slate-700 hover:bg-[var(--enver-hover)] disabled:opacity-60"
      title="Перезавантажити дані з сервера"
    >
      <RefreshCw
        className={`h-3.5 w-3.5 ${spin || pending ? "animate-spin" : ""}`}
        aria-hidden
      />
      Оновити
    </button>
  );
}
