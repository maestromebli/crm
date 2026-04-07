"use client";

import { useEffect, useState } from "react";

type PortalPayload = {
  dealId: string;
  title: string;
  clientName: string;
  stageName: string;
  contractStatus: string | null;
  installationDate: string | null;
  expectedCloseDate: string | null;
  docs: Array<{ id: string; fileName: string; category: string; createdAt: string }>;
  invoices: Array<{
    id: string;
    amount: number;
    status: string;
    type: string;
    createdAt: string;
  }>;
  transactions: Array<{
    id: string;
    amount: number;
    currency: string;
    paidAt: string | null;
    category: string;
    status: string;
  }>;
  timeline: Array<{ id: string; at: string; stageName: string }>;
};

export function ClientPortalView({
  token,
  payload,
}: {
  token: string;
  payload: PortalPayload;
}) {
  const [messages, setMessages] = useState<
    Array<{ id: string; body: string; createdAt: string }>
  >([]);
  const [text, setText] = useState("");

  const loadMessages = async () => {
    const r = await fetch(`/api/client/${token}/messages`, { cache: "no-store" });
    const j = (await r.json()) as { messages?: Array<{ id: string; body: string; createdAt: string }> };
    setMessages(Array.isArray(j.messages) ? j.messages : []);
  };

  useEffect(() => {
    void loadMessages();
  }, []);

  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl space-y-4 bg-[var(--enver-bg)] p-4 text-[var(--enver-text)]">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-xs uppercase tracking-wide text-slate-500">ENVER Client Portal</p>
        <h1 className="mt-1 text-xl font-semibold text-slate-900">{payload.title}</h1>
        <p className="text-sm text-slate-600">{payload.clientName}</p>
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-lg bg-slate-50 p-2">
            <p className="text-slate-500">Current stage</p>
            <p className="font-semibold text-slate-900">{payload.stageName}</p>
          </div>
          <div className="rounded-lg bg-slate-50 p-2">
            <p className="text-slate-500">Contract</p>
            <p className="font-semibold text-slate-900">{payload.contractStatus ?? "N/A"}</p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">Timeline</h2>
        <div className="mt-2 space-y-2 text-sm">
          {payload.timeline.map((t) => (
            <div key={t.id} className="rounded-lg bg-slate-50 p-2">
              <p className="font-medium text-slate-900">{t.stageName}</p>
              <p className="text-xs text-slate-500">{new Date(t.at).toLocaleString()}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">Documents</h2>
        <div className="mt-2 space-y-2 text-sm">
          {payload.docs.map((d) => (
            <div key={d.id} className="rounded-lg bg-slate-50 p-2">
              <a
                href={`/api/client/${token}/attachment/${d.id}`}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-slate-900 underline decoration-slate-300 underline-offset-2"
              >
                {d.fileName}
              </a>
              <p className="text-xs text-slate-500">
                {d.category} · {new Date(d.createdAt).toLocaleDateString()}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">Payments</h2>
        <div className="mt-2 space-y-2">
          {payload.invoices.map((i) => (
            <div key={i.id} className="rounded-lg bg-slate-50 p-2 text-sm">
              <p className="font-medium text-slate-900">
                {i.type} · {i.amount.toFixed(2)} UAH
              </p>
              <p className="text-xs text-slate-500">{i.status}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">Schedule</h2>
        <div className="mt-2 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
          <div className="rounded-lg bg-slate-50 p-2">
            <p className="text-xs text-slate-500">Measurement / Delivery target</p>
            <p className="font-medium text-slate-900">
              {payload.expectedCloseDate
                ? new Date(payload.expectedCloseDate).toLocaleDateString()
                : "Pending"}
            </p>
          </div>
          <div className="rounded-lg bg-slate-50 p-2">
            <p className="text-xs text-slate-500">Installation</p>
            <p className="font-medium text-slate-900">
              {payload.installationDate
                ? new Date(payload.installationDate).toLocaleDateString()
                : "Pending"}
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">Approvals</h2>
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white"
            onClick={async () => {
              await fetch(`/api/client/${token}/approvals`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "approve_quote" }),
              });
            }}
          >
            Approve quote
          </button>
          <button
            type="button"
            className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white"
            onClick={async () => {
              await fetch(`/api/client/${token}/approvals`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "approve_changes" }),
              });
            }}
          >
            Approve changes
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">Communication</h2>
        <div className="mt-2 space-y-2">
          {messages.map((m) => (
            <div key={m.id} className="rounded-lg bg-slate-50 p-2 text-sm text-slate-800">
              <p>{m.body}</p>
              <p className="mt-1 text-xs text-slate-500">
                {new Date(m.createdAt).toLocaleString()}
              </p>
            </div>
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Message..."
            className="h-9 flex-1 rounded-lg border border-slate-300 px-3 text-sm"
          />
          <button
            type="button"
            className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white"
            onClick={async () => {
              const msg = text.trim();
              if (!msg) return;
              await fetch(`/api/client/${token}/messages`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: msg }),
              });
              setText("");
              await loadMessages();
            }}
          >
            Send
          </button>
        </div>
      </section>
    </main>
  );
}
