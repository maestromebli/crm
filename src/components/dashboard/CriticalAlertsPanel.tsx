"use client";

import { useMemo, useState } from "react";
import { patchJson } from "../../lib/api/patch-json";

type AlertItem = {
  id: string;
  userId: string;
  userLabel: string;
  channel: string;
  kind: "delivery_failed" | "outbound_failed";
  message: string;
  count: number;
  createdAt: string;
  readAt?: string;
};

type Props = {
  initialAlerts: AlertItem[];
};

export function CriticalAlertsPanel({ initialAlerts }: Props) {
  const [alerts, setAlerts] = useState<AlertItem[]>(initialAlerts);
  const [mode, setMode] = useState<"unread" | "all">("unread");
  const unread = useMemo(() => alerts.filter((a) => !a.readAt), [alerts]);
  const viewItems = useMemo(
    () => (mode === "unread" ? alerts.filter((a) => !a.readAt) : alerts),
    [alerts, mode],
  );

  const acknowledge = async (id: string) => {
    try {
      await patchJson("/api/settings/communications/alerts", { id });
    } catch {
      return;
    }
    setAlerts((prev) =>
      prev.map((a) =>
        a.id === id ? { ...a, readAt: new Date().toISOString() } : a,
      ),
    );
  };

  const acknowledgeAll = async () => {
    try {
      await patchJson("/api/settings/communications/alerts", {
        ackAll: true,
        unreadOnly: true,
      });
    } catch {
      return;
    }
    const now = new Date().toISOString();
    setAlerts((prev) => prev.map((a) => ({ ...a, readAt: a.readAt ?? now })));
  };

  return (
    <section className="space-y-3 text-left">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[var(--enver-text)]">
          Комунікаційні алерти
        </h2>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-medium text-rose-700">
            Непрочитані: {unread.length}
          </span>
          <button
            type="button"
            onClick={() => setMode((m) => (m === "unread" ? "all" : "unread"))}
            className="rounded border border-slate-200 bg-[var(--enver-card)] px-2 py-0.5 text-[10px] text-slate-700"
          >
            {mode === "unread" ? "Показати всі" : "Показати непрочитані"}
          </button>
          <button
            type="button"
            onClick={() => void acknowledgeAll()}
            disabled={unread.length === 0}
            className="rounded border border-rose-200 bg-[var(--enver-card)] px-2 py-0.5 text-[10px] text-rose-700 disabled:opacity-50"
          >
            Підтвердити всі
          </button>
        </div>
      </div>
      {viewItems.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-3 text-xs text-slate-600">
          Критичних подій-сповіщень немає.
        </p>
      ) : (
        <div className="space-y-2">
          {viewItems.slice(0, 60).map((a) => (
            <div
              key={a.id}
              className={`rounded-lg border px-3 py-2 text-xs ${
                a.readAt
                  ? "border-slate-200 bg-slate-50 text-slate-600"
                  : "border-rose-200 bg-rose-50 text-rose-900"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium">
                    {a.userLabel} · {a.channel} · {a.kind}
                  </p>
                  <p className="mt-0.5">{a.message}</p>
                  <p className="mt-0.5 text-[10px] opacity-80">
                    Кількість: {a.count} · {new Date(a.createdAt).toLocaleString("uk-UA")}
                  </p>
                </div>
                {!a.readAt ? (
                  <button
                    type="button"
                    onClick={() => void acknowledge(a.id)}
                    className="rounded border border-rose-200 bg-[var(--enver-card)] px-2 py-1 text-[10px] font-medium text-rose-700"
                  >
                    Підтвердити
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
