"use client";

import { useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";

type PulseResponse = {
  pulseKey: string;
  refreshedAt: string;
};

const POLL_MS = 20000;

export function DashboardRealtimePill() {
  const router = useRouter();
  const [hasUpdate, setHasUpdate] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const pulseRef = useRef<string | null>(null);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setInterval> | null = null;

    const tick = async () => {
      try {
        const res = await fetch("/api/realtime/pulse", { cache: "no-store" });
        if (!res.ok) return;
        const json = (await res.json()) as PulseResponse;
        if (!pulseRef.current) {
          pulseRef.current = json.pulseKey;
          return;
        }
        if (pulseRef.current !== json.pulseKey) {
          pulseRef.current = json.pulseKey;
          if (active) setHasUpdate(true);
        }
      } catch {
        // silent fallback; dashboard keeps working without live pulse.
      }
    };

    void tick();
    timer = setInterval(() => {
      void tick();
    }, POLL_MS);

    return () => {
      active = false;
      if (timer) clearInterval(timer);
    };
  }, []);

  return (
    <button
      type="button"
      onClick={() => {
        setIsRefreshing(true);
        router.refresh();
        setHasUpdate(false);
        window.setTimeout(() => setIsRefreshing(false), 600);
      }}
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
        hasUpdate
          ? "border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
          : "border-[var(--enver-border)] bg-[var(--enver-card)] text-[var(--enver-text-muted)] hover:bg-[var(--enver-hover)]"
      }`}
      title={
        hasUpdate
          ? "Є нові зміни у CRM. Натисніть для оновлення."
          : "Перевірка live-оновлень увімкнена."
      }
    >
      <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
      {hasUpdate ? "Є live-оновлення" : "Live-пульс"}
    </button>
  );
}
