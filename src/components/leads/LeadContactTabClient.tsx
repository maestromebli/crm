"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { LeadDetailRow } from "../../features/leads/queries";

type SearchItem = {
  id: string;
  fullName: string;
  phone: string | null;
  email: string | null;
};

type Props = {
  lead: LeadDetailRow;
  canUpdateLead: boolean;
  canSearchContacts: boolean;
};

export function LeadContactTabClient({
  lead,
  canUpdateLead,
  canSearchContacts,
}: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchItem[]>([]);
  const [searching, setSearching] = useState(false);

  const refresh = useCallback(() => {
    router.refresh();
  }, [router]);

  useEffect(() => {
    if (!canSearchContacts || q.trim().length < 2) {
      setHits([]);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const t = setTimeout(() => {
      void (async () => {
        try {
          const r = await fetch(
            `/api/contacts?q=${encodeURIComponent(q.trim())}`,
          );
          const j = (await r.json()) as {
            items?: SearchItem[];
            error?: string;
          };
          if (cancelled) return;
          if (!r.ok) {
            setHits([]);
            return;
          }
          setHits(j.items ?? []);
        } catch {
          if (!cancelled) setHits([]);
        } finally {
          if (!cancelled) setSearching(false);
        }
      })();
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [q, canSearchContacts]);

  const linkContact = async (contactId: string) => {
    setErr(null);
    setBusy(true);
    try {
      const r = await fetch(`/api/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactId }),
      });
      const j = (await r.json()) as { error?: string };
      if (!r.ok) throw new Error(j.error ?? "Помилка");
      setQ("");
      setHits([]);
      refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Помилка");
    } finally {
      setBusy(false);
    }
  };

  const unlink = async () => {
    setErr(null);
    setBusy(true);
    try {
      const r = await fetch(`/api/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactId: null }),
      });
      const j = (await r.json()) as { error?: string };
      if (!r.ok) throw new Error(j.error ?? "Помилка");
      refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Помилка");
    } finally {
      setBusy(false);
    }
  };

  const wrap =
    "rounded-2xl border border-slate-200 bg-[var(--enver-card)] p-4 text-sm shadow-sm";

  if (lead.contact) {
    return (
      <div className="space-y-4">
        <section className={wrap}>
          <h2 className="text-sm font-semibold text-[var(--enver-text)]">
            Повʼязаний контакт
          </h2>
          <p className="mt-2 text-slate-700">{lead.contact.fullName}</p>
          <p className="text-xs text-slate-500">
            {lead.contact.lifecycle === "CUSTOMER"
              ? "Категорія: клієнт"
              : "Категорія: лід"}
          </p>
          <p className="text-xs text-slate-500">
            {[lead.contact.phone, lead.contact.email].filter(Boolean).join(" · ")}
          </p>
          <Link
            href={`/contacts/${lead.contact.id}`}
            className="mt-3 inline-block text-xs font-medium text-[var(--enver-text)] underline"
          >
            Відкрити картку контакту →
          </Link>
          {canUpdateLead ? (
            <div className="mt-4 border-t border-slate-100 pt-3">
              <button
                type="button"
                disabled={busy}
                onClick={() => void unlink()}
                className="text-xs text-rose-700 underline hover:text-rose-900 disabled:opacity-50"
              >
                Відвʼязати контакт
              </button>
            </div>
          ) : null}
        </section>
        {err ? (
          <p className="text-xs text-rose-700">{err}</p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {err ? (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-800">
          {err}
        </p>
      ) : null}

      <section className={wrap}>
        <h2 className="text-sm font-semibold text-[var(--enver-text)]">
          Дані з ліда
        </h2>
        <p className="mt-2 text-xs text-slate-600">
          Контакт у довіднику створюється автоматично, коли на картці ліда є імʼя,
          телефон або email. Нижче — поточні поля ліда.
        </p>
        <dl className="mt-3 space-y-1.5 text-xs">
          <div>
            <dt className="text-slate-500">Імʼя</dt>
            <dd className="text-[var(--enver-text)]">
              {lead.contactName ?? "—"}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Телефон</dt>
            <dd className="text-[var(--enver-text)]">{lead.phone ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Email</dt>
            <dd className="text-[var(--enver-text)]">{lead.email ?? "—"}</dd>
          </div>
        </dl>
      </section>

      {canUpdateLead && canSearchContacts ? (
        <section className={wrap}>
          <h2 className="text-sm font-semibold text-[var(--enver-text)]">
            Привʼязати існуючий контакт
          </h2>
          <p className="mt-1 text-xs text-slate-600">
            Пошук за іменем, телефоном або email (мінімум 2 символи).
          </p>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Пошук…"
            className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs"
          />
          {searching ? (
            <p className="mt-2 text-[11px] text-slate-500">Пошук…</p>
          ) : hits.length > 0 ? (
            <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto text-xs">
              {hits.map((h) => (
                <li key={h.id}>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void linkContact(h.id)}
                    className="w-full rounded-lg border border-slate-100 bg-slate-50 px-2 py-1.5 text-left hover:bg-slate-100 disabled:opacity-50"
                  >
                    <span className="font-medium text-[var(--enver-text)]">
                      {h.fullName}
                    </span>
                    <span className="block text-[10px] text-slate-500">
                      {[h.phone, h.email].filter(Boolean).join(" · ")}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : q.trim().length >= 2 ? (
            <p className="mt-2 text-[11px] text-slate-500">Нічого не знайдено</p>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
