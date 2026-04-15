"use client";

import { format } from "date-fns";
import { uk } from "date-fns/locale";
import { useCallback, useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Bell, CalendarClock, CircleDollarSign, FileText, RefreshCcw } from "lucide-react";
import { cn } from "../../../../lib/utils";
import { REALTIME_POLICY } from "../../../../config/realtime-policy";

type Item = {
  id: string;
  type: string;
  category: string;
  headline: string;
  detail: string | null;
  createdAt: string;
  actor: string | null;
};

type Props = {
  leadId: string;
  className?: string;
};

export function LeadHubTimelineStrip({ leadId, className }: Props) {
  const reduceMotion = useReducedMotion();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/leads/${leadId}/activity`);
      const j = (await r.json()) as { items?: Item[] };
      if (r.ok) setItems((j.items ?? []).slice(0, 8));
      else setItems([]);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const id = window.setInterval(() => {
      void load();
    }, REALTIME_POLICY.leadTimelinePollingMs);
    return () => window.clearInterval(id);
  }, [load]);

  function iconFor(item: Item) {
    const key = `${item.type} ${item.category}`.toLowerCase();
    if (key.includes("file")) return <FileText className="h-3.5 w-3.5" aria-hidden />;
    if (key.includes("payment")) return <CircleDollarSign className="h-3.5 w-3.5" aria-hidden />;
    if (key.includes("call") || key.includes("meeting")) {
      return <CalendarClock className="h-3.5 w-3.5" aria-hidden />;
    }
    if (key.includes("status") || key.includes("stage")) {
      return <RefreshCcw className="h-3.5 w-3.5" aria-hidden />;
    }
    return <Bell className="h-3.5 w-3.5" aria-hidden />;
  }

  return (
    <section
      className={cn(
        "rounded-[14px] border border-[var(--enver-border)]/80 bg-gradient-to-br from-[var(--enver-card)] to-[var(--enver-surface)] p-3 shadow-[0_10px_24px_rgba(15,23,42,0.08)]",
        className,
      )}
      aria-label="Останні події"
    >
      <h3 className="text-[10px] font-semibold uppercase tracking-wide text-[var(--enver-muted)]">
        Таймлайн
      </h3>
      {loading ? (
        <p className="mt-2 text-[11px] text-[var(--enver-muted)]">Завантаження…</p>
      ) : items.length === 0 ? (
        <p className="mt-2 text-[11px] text-[var(--enver-muted)]">
          Подій ще немає.
        </p>
      ) : (
        <ul className="mt-2 space-y-2">
          {items.map((it, i) => (
            <motion.li
              key={it.id}
              initial={reduceMotion ? false : { opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="border-l-2 border-[var(--enver-border)] pl-2.5 text-[11px] leading-snug"
            >
              <p className="flex items-center gap-1.5 font-medium text-[var(--enver-text)]">
                {iconFor(it)}
                <span>{it.headline}</span>
              </p>
              {it.detail ? (
                <p className="mt-0.5 text-[var(--enver-text-muted)]">{it.detail}</p>
              ) : null}
              <p className="mt-1 text-[10px] text-[var(--enver-muted)]">
                {format(new Date(it.createdAt), "d MMM HH:mm", { locale: uk })}
                {it.actor ? ` · ${it.actor}` : ""}
              </p>
            </motion.li>
          ))}
        </ul>
      )}
    </section>
  );
}
