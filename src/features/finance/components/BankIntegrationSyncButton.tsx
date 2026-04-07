"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Button } from "../../../components/ui/button";

type Props = {
  integrationId: string;
  /** Якщо false — кнопку не показуємо. */
  canSync: boolean;
  /** Демо-рядок з mock — синхронізація недоступна. */
  isDemo: boolean;
};

export function BankIntegrationSyncButton({ integrationId, canSync, isDemo }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  if (!canSync || isDemo) {
    return <span className="text-slate-400">—</span>;
  }

  const run = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/finance/banking/sync", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ integrationId }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        simulated?: boolean;
      };
      if (!res.ok) {
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      router.refresh();
      if (data.simulated) {
        window.alert(
          "Синхронізацію зафіксовано (без API-токена в env — тільки оновлення часу та статусу).",
        );
      }
    } catch (e) {
      console.error(e);
      window.alert(e instanceof Error ? e.message : "Не вдалося синхронізувати");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="h-7 gap-1 px-2 text-[11px]"
      onClick={() => void run()}
      disabled={loading}
      aria-busy={loading}
      aria-label="Синхронізувати підключення банку"
    >
      <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} aria-hidden />
      {loading ? "…" : "Синхр."}
    </Button>
  );
}
