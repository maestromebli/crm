"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { deleteJson, patchJson, postJson } from "@/lib/api/patch-json";

type Flow = {
  id: string;
  name: string;
  trigger: string;
  enabled: boolean;
  graphJson: unknown;
  updatedAt: string;
};

type EventHealthMini = {
  window?: {
    last24h?: {
      processedRate?: number;
      pending?: number;
    };
  };
  backlog?: {
    pendingTotal?: number;
  };
};

const TRIGGERS = [
  "deal.stage_changed",
  "payment.received",
  "task.overdue",
  "production.delayed",
  "quote.approved",
  "contract.signed",
  "procurement.created",
  "production.started",
];

const TEMPLATE_GRAPH = {
  nodes: [
    { id: "trigger", type: "trigger", config: { label: "payment.received" } },
    { id: "condition", type: "condition", config: { field: "amountPercent", op: "gte", value: 70 } },
    { id: "action1", type: "action", config: { type: "updateStage", stageId: "" } },
    { id: "action2", type: "action", config: { type: "createTask", title: "Запустити виробництво" } },
  ],
  connections: [
    { from: "trigger", to: "condition" },
    { from: "condition", to: "action1" },
    { from: "condition", to: "action2" },
  ],
  conditions: [{ field: "amountPercent", op: "gte", value: 70 }],
  actions: [{ type: "createTask", title: "Запустити виробництво", priority: "HIGH" }],
};

export function AutomationBuilderClient() {
  const [flows, setFlows] = useState<Flow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [name, setName] = useState("Оплата 70% -> Запустити виробництво");
  const [trigger, setTrigger] = useState(TRIGGERS[1]);
  const [graphJson, setGraphJson] = useState(
    JSON.stringify(TEMPLATE_GRAPH, null, 2),
  );
  const [eventHealth, setEventHealth] = useState<EventHealthMini | null>(null);
  const [busy, setBusy] = useState(false);
  const selected = useMemo(
    () => flows.find((x) => x.id === selectedId) ?? null,
    [flows, selectedId],
  );

  const load = async () => {
    const r = await fetch("/api/crm/automation/flows");
    const j = (await r.json()) as { flows?: Flow[] };
    setFlows(Array.isArray(j.flows) ? j.flows : []);
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadEventHealth = async () => {
      try {
        const r = await fetch("/api/crm/event-стан");
        if (!r.ok) return;
        const j = (await r.json()) as EventHealthMini;
        if (!cancelled) setEventHealth(j);
      } catch {
        // non-blocking widget
      }
    };
    void loadEventHealth();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selected) return;
    setName(selected.name);
    setTrigger(selected.trigger);
    setGraphJson(JSON.stringify(selected.graphJson ?? {}, null, 2));
  }, [selected]);

  const save = async () => {
    setBusy(true);
    try {
      const parsed = JSON.parse(graphJson) as object;
      if (selected) {
        await patchJson(`/api/crm/automation/flows/${selected.id}`, {
          name,
          trigger,
          graphJson: parsed,
        });
      } else {
        await postJson<{ ok?: boolean }>("/api/crm/automation/flows", {
          name,
          trigger,
          graphJson: parsed,
          enabled: true,
        });
      }
      await load();
    } finally {
      setBusy(false);
    }
  };

  const toggleEnabled = async (flow: Flow) => {
    await patchJson(`/api/crm/automation/flows/${flow.id}`, {
      enabled: !flow.enabled,
    });
    await load();
  };

  const pendingTotal = eventHealth?.backlog?.pendingTotal ?? null;
  const pending24 = eventHealth?.window?.last24h?.pending ?? null;
  const processedRate = eventHealth?.window?.last24h?.processedRate ?? null;

  const healthStatus =
    pendingTotal == null || pending24 == null || processedRate == null
      ? null
      : pendingTotal > 200 || pending24 > 80
        ? "backlog"
        : processedRate < 90 || pending24 > 20
          ? "warning"
          : "ok";

  return (
    <main className="mx-auto grid max-w-7xl grid-cols-1 gap-4 p-4 md:grid-cols-[280px_1fr] md:p-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-3">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">Потоки автоматизації</h2>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" asChild>
              <Link href="/crm/automation/event-стан">Стан подій</Link>
            </Button>
            {healthStatus ? (
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                  healthStatus === "ok"
                    ? "bg-emerald-100 text-emerald-900"
                    : healthStatus === "warning"
                      ? "bg-amber-100 text-amber-900"
                      : "bg-rose-100 text-rose-900"
                }`}
                title={
                  pendingTotal != null && pending24 != null && processedRate != null
                    ? `Черга: ${pendingTotal} · У роботі за 24г: ${pending24} · Оброблено за 24г: ${processedRate}%`
                    : undefined
                }
              >
                {healthStatus === "ok" ? "норма" : healthStatus === "warning" ? "увага" : "черга"}
              </span>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setSelectedId(null);
                setName("Новий потік автоматизації");
                setTrigger(TRIGGERS[0]);
                setGraphJson(JSON.stringify(TEMPLATE_GRAPH, null, 2));
              }}
            >
              Новий
            </Button>
          </div>
        </div>
        <div className="space-y-2">
          {flows.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setSelectedId(f.id)}
              className={`w-full rounded-lg border px-2 py-2 text-left text-xs ${
                selectedId === f.id
                  ? "border-blue-400 bg-blue-50"
                  : "border-slate-200 bg-slate-50"
              }`}
            >
              <p className="font-semibold text-slate-900">{f.name}</p>
              <p className="mt-0.5 text-slate-600">{f.trigger}</p>
              <p className="mt-1 text-[10px] uppercase text-slate-500">
                {f.enabled ? "увімкнено" : "вимкнено"}
              </p>
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
        <div className="grid gap-2 md:grid-cols-2">
          <label className="space-y-1 text-xs text-slate-600">
            <span>Назва потоку</span>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="space-y-1 text-xs text-slate-600">
            <span>Тригер</span>
            <select
              value={trigger}
              onChange={(e) => setTrigger(e.target.value)}
              className="h-9 rounded-md border border-slate-200 px-2 text-sm"
            >
              {TRIGGERS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
            Попередній перегляд графа
          </p>
          <div className="flex flex-wrap gap-2">
            {["Тригер", "Умова", "Дія"].map((n) => (
              <div
                key={n}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-800"
              >
                {n}
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Граф зберігається у JSON (`nodes` + `connections`) і виконується внутрішнім рушієм автоматизації.
          </p>
        </div>

        <label className="space-y-1 text-xs text-slate-600">
          <span>JSON потоку (nodes, connections, conditions, actions)</span>
          <Textarea
            value={graphJson}
            onChange={(e) => setGraphJson(e.target.value)}
            className="min-h-[300px] font-mono text-xs"
          />
        </label>

        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={() => void save()} disabled={busy}>
            {busy ? "Збереження..." : "Зберегти потік"}
          </Button>
          {selected ? (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => void toggleEnabled(selected)}
              >
                {selected.enabled ? "Вимкнути" : "Увімкнути"}
              </Button>
              <Button
                type="button"
                variant="enverDanger"
                onClick={async () => {
                  await deleteJson<{ ok?: boolean }>(
                    `/api/crm/automation/flows/${selected.id}`,
                  );
                  setSelectedId(null);
                  await load();
                }}
              >
                Видалити
              </Button>
            </>
          ) : null}
        </div>
      </section>
    </main>
  );
}
