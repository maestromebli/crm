"use client";

import { useCallback, useEffect, useState } from "react";
import { patchJson } from "@/lib/api/patch-json";

type UserLite = { id: string; name: string | null; email: string };
type ChannelHealth = {
  lastWebhookAt?: string;
  lastInboundAt?: string;
  lastOutboundAt?: string;
  lastErrorAt?: string;
  lastError?: string;
  outboundSentCount?: number;
  outboundFailedCount?: number;
  deliveryFailedCount?: number;
};

type HealthPayload = {
  ok: true;
  users: UserLite[];
  selectedUserId: string;
  channels: Record<string, ChannelHealth>;
  policy: {
    deliveryFailAlertThreshold: number;
    outboundFailAlertThreshold: number;
  };
  digest: Array<{
    userId: string;
    userLabel: string;
    channel: string;
    sent: number;
    outboundFailed: number;
    deliveryFailed: number;
    alert: boolean;
  }>;
};

type CheckPayload = {
  ok: true;
  checks: Record<string, { enabled: boolean; ready: boolean; missing: string[] }>;
};

function dt(v?: string): string {
  if (!v) return "—";
  try {
    return new Date(v).toLocaleString();
  } catch {
    return v;
  }
}

export function CommunicationsHealthClient() {
  const [data, setData] = useState<HealthPayload | null>(null);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [checks, setChecks] = useState<CheckPayload["checks"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [savingPolicy, setSavingPolicy] = useState(false);
  const [policyDraft, setPolicyDraft] = useState<{
    deliveryFailAlertThreshold: number;
    outboundFailAlertThreshold: number;
  }>({ deliveryFailAlertThreshold: 3, outboundFailAlertThreshold: 3 });
  const [error, setError] = useState<string | null>(null);
  const [alerts, setAlerts] = useState<
    Array<{
      id: string;
      userId: string;
      channel: string;
      kind: "delivery_failed" | "outbound_failed";
      message: string;
      count: number;
      createdAt: string;
      readAt?: string;
    }>
  >([]);

  const load = useCallback(async (userId?: string) => {
    setLoading(true);
    setError(null);
    const q = userId ? `?userId=${encodeURIComponent(userId)}` : "";
    const r = await fetch(`/api/settings/communications/health${q}`);
    const j = (await r.json()) as HealthPayload & { error?: string };
    if (!r.ok) throw new Error(j.error ?? "Помилка");
    setData(j);
    setSelectedUserId(j.selectedUserId);
    setPolicyDraft(j.policy);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load().catch((e) => {
      setLoading(false);
      setError(e instanceof Error ? e.message : "Помилка");
    });
  }, [load]);

  const loadAlerts = useCallback(async () => {
    try {
      const r = await fetch("/api/settings/communications/alerts?unreadOnly=1");
      const j = (await r.json()) as {
        items?: Array<{
          id: string;
          userId: string;
          channel: string;
          kind: "delivery_failed" | "outbound_failed";
          message: string;
          count: number;
          createdAt: string;
          readAt?: string;
        }>;
      };
      if (!r.ok) return;
      setAlerts(j.items ?? []);
    } catch {
      // ignore optional alerts fetch errors
    }
  }, []);

  useEffect(() => {
    void loadAlerts();
  }, [loadAlerts]);

  const runCheck = async () => {
    if (!selectedUserId) return;
    setChecking(true);
    try {
      const r = await fetch("/api/settings/communications/health", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: selectedUserId }),
      });
      const j = (await r.json()) as CheckPayload & { error?: string };
      if (!r.ok) throw new Error(j.error ?? "Помилка check");
      setChecks(j.checks);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Помилка check");
    } finally {
      setChecking(false);
    }
  };

  const savePolicy = async () => {
    setSavingPolicy(true);
    try {
      const r = await fetch("/api/settings/communications/health", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "policy",
          deliveryFailAlertThreshold: policyDraft.deliveryFailAlertThreshold,
          outboundFailAlertThreshold: policyDraft.outboundFailAlertThreshold,
        }),
      });
      const j = (await r.json()) as { ok?: boolean; error?: string };
      if (!r.ok) throw new Error(j.error ?? "Помилка збереження policy");
      await load(selectedUserId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Помилка policy");
    } finally {
      setSavingPolicy(false);
    }
  };

  const ackAlert = async (id: string) => {
    try {
      await patchJson("/api/settings/communications/alerts", { id });
      await loadAlerts();
    } catch {
      // ignore ack errors
    }
  };

  if (loading) return <p className="text-xs text-slate-500">Завантаження…</p>;
  if (error) {
    return (
      <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
        {error}
      </p>
    );
  }
  if (!data) return null;

  const channels = data.channels ?? {};
  const channelNames = ["telegram", "whatsapp", "viber", "sms", "phone"];

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-[var(--enver-card)] p-3">
        <label className="mb-1 block text-[11px] text-slate-600">Співробітник</label>
        <div className="flex gap-2">
          <select
            value={selectedUserId}
            onChange={(e) => {
              const id = e.target.value;
              setSelectedUserId(id);
              void load(id);
            }}
            className="w-full rounded-md border border-slate-200 bg-[var(--enver-card)] px-2 py-1.5 text-xs"
          >
            {data.users.map((u) => (
              <option key={u.id} value={u.id}>
                {(u.name?.trim() || "—") + " · " + u.email}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => void runCheck()}
            disabled={checking}
            className="rounded-md bg-slate-900 px-3 py-1.5 text-xs text-white disabled:opacity-50"
          >
            {checking ? "Перевірка…" : "Check"}
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-[var(--enver-card)] p-3">
        <p className="mb-2 text-xs font-semibold text-slate-800">
          Internal alerts (unread)
        </p>
        {alerts.length === 0 ? (
          <p className="text-xs text-slate-500">Немає нових alert-подій.</p>
        ) : (
          <div className="space-y-1">
            {alerts.slice(0, 30).map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between gap-2 rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-[11px]"
              >
                <span className="text-rose-800">
                  {a.message} · {new Date(a.createdAt).toLocaleString()}
                </span>
                <button
                  type="button"
                  onClick={() => void ackAlert(a.id)}
                  className="rounded bg-[var(--enver-card)] px-2 py-0.5 text-[10px] text-slate-700"
                >
                  Ack
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-[var(--enver-card)] p-3">
        <p className="mb-2 text-xs font-semibold text-slate-800">Alert thresholds</p>
        <div className="grid gap-2 md:grid-cols-2">
          <label className="text-[11px] text-slate-600">
            Delivery fail threshold
            <input
              type="number"
              min={1}
              value={policyDraft.deliveryFailAlertThreshold}
              onChange={(e) =>
                setPolicyDraft((p) => ({
                  ...p,
                  deliveryFailAlertThreshold: Number(e.target.value || 1),
                }))
              }
              className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1 text-xs"
            />
          </label>
          <label className="text-[11px] text-slate-600">
            Outbound fail threshold
            <input
              type="number"
              min={1}
              value={policyDraft.outboundFailAlertThreshold}
              onChange={(e) =>
                setPolicyDraft((p) => ({
                  ...p,
                  outboundFailAlertThreshold: Number(e.target.value || 1),
                }))
              }
              className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1 text-xs"
            />
          </label>
        </div>
        <button
          type="button"
          onClick={() => void savePolicy()}
          disabled={savingPolicy}
          className="mt-2 rounded-md bg-slate-900 px-3 py-1.5 text-xs text-white disabled:opacity-50"
        >
          {savingPolicy ? "Збереження…" : "Зберегти thresholds"}
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {channelNames.map((name) => {
          const h = channels[name] ?? {};
          const c = checks?.[name];
          return (
            <div key={name} className="rounded-xl border border-slate-200 bg-[var(--enver-card)] p-3 text-xs">
              <p className="font-semibold uppercase tracking-wide text-slate-700">{name}</p>
              <p className="mt-1 text-slate-500">Webhook: {dt(h.lastWebhookAt)}</p>
              <p className="text-slate-500">Inbound: {dt(h.lastInboundAt)}</p>
              <p className="text-slate-500">Outbound: {dt(h.lastOutboundAt)}</p>
              <p className="mt-1 text-slate-600">
                Sent: {h.outboundSentCount ?? 0} · OutFail: {h.outboundFailedCount ?? 0}
              </p>
              <p className="text-slate-600">DeliveryFail: {h.deliveryFailedCount ?? 0}</p>
              <p className="mt-1 text-rose-700">
                {h.lastError ? `Last error: ${h.lastError}` : "Last error: —"}
              </p>
              {c ? (
                <p className={`mt-2 ${c.ready ? "text-emerald-700" : "text-amber-700"}`}>
                  {c.enabled
                    ? c.ready
                      ? "Config OK"
                      : `Missing: ${c.missing.join(", ")}`
                    : "Channel disabled"}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="rounded-xl border border-slate-200 bg-[var(--enver-card)] p-3">
        <p className="mb-2 text-xs font-semibold text-slate-800">Weekly digest (all users)</p>
        {data.digest.length === 0 ? (
          <p className="text-xs text-slate-500">Поки немає подій.</p>
        ) : (
          <div className="space-y-1">
            {data.digest.slice(0, 50).map((r) => (
              <div
                key={`${r.userId}:${r.channel}`}
                className={`rounded-md border px-2 py-1 text-[11px] ${
                  r.alert ? "border-rose-200 bg-rose-50" : "border-slate-200 bg-slate-50"
                }`}
              >
                {r.userLabel} · {r.channel} · sent {r.sent} · outFail {r.outboundFailed} · deliveryFail{" "}
                {r.deliveryFailed} {r.alert ? "· ALERT" : ""}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
