"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ExternalLink, KanbanSquare, Loader2, Save } from "lucide-react";

import type { ContactDetailRow } from "../../features/contacts/queries";

export type ContactOverviewClientProps = {
  contact: ContactDetailRow;
  canUpdate: boolean;
};

export function ContactOverviewClient({
  contact,
  canUpdate,
}: ContactOverviewClientProps) {
  const router = useRouter();
  const [fullName, setFullName] = useState(contact.fullName);
  const [firstName, setFirstName] = useState(contact.firstName ?? "");
  const [lastName, setLastName] = useState(contact.lastName ?? "");
  const [phone, setPhone] = useState(contact.phone ?? "");
  const [email, setEmail] = useState(contact.email ?? "");
  const [instagramHandle, setInstagramHandle] = useState(
    contact.instagramHandle ?? "",
  );
  const [telegramHandle, setTelegramHandle] = useState(
    contact.telegramHandle ?? "",
  );
  const [city, setCity] = useState(contact.city ?? "");
  const [country, setCountry] = useState(contact.country ?? "");
  const [notes, setNotes] = useState(contact.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const dirty =
    fullName !== contact.fullName ||
    firstName !== (contact.firstName ?? "") ||
    lastName !== (contact.lastName ?? "") ||
    phone !== (contact.phone ?? "") ||
    email !== (contact.email ?? "") ||
    instagramHandle !== (contact.instagramHandle ?? "") ||
    telegramHandle !== (contact.telegramHandle ?? "") ||
    city !== (contact.city ?? "") ||
    country !== (contact.country ?? "") ||
    notes !== (contact.notes ?? "");

  useEffect(() => {
    if (dirty) setOk(false);
  }, [dirty]);

  async function handleSave() {
    if (!canUpdate) return;
    setSaving(true);
    setErr(null);
    setOk(false);
    try {
      const r = await fetch(`/api/contacts/${contact.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          firstName: firstName.trim() || null,
          lastName: lastName.trim() || null,
          phone: phone.trim() || null,
          email: email.trim() || null,
          instagramHandle: instagramHandle.trim() || null,
          telegramHandle: telegramHandle.trim() || null,
          city: city.trim() || null,
          country: country.trim() || null,
          notes: notes.trim() || null,
        }),
      });
      const j = (await r.json()) as { error?: string };
      if (!r.ok) throw new Error(j.error ?? "Не вдалося зберегти");
      setOk(true);
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Помилка");
    } finally {
      setSaving(false);
    }
  }

  const leadIds = new Set(contact.leads.map((l) => l.id));
  const extraLinked = contact.linkedLeads.filter((l) => !leadIds.has(l.leadId));

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-[var(--enver-card)] p-4 shadow-sm md:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-[var(--enver-text)]">
              Дані контакту
            </h2>
            <p className="mt-1 text-xs text-slate-600">
              {canUpdate
                ? "Поля збережуться в профілі картки для всіх повʼязаних лідів та угод."
                : "Редагування доступне з правами на оновлення лідів (LEADS_UPDATE)."}
            </p>
          </div>
          {canUpdate ? (
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={!dirty || saving}
              className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-xs font-medium text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              Зберегти
            </button>
          ) : null}
        </div>

        {err ? (
          <p className="mt-3 text-xs text-rose-700" role="alert">
            {err}
          </p>
        ) : null}
        {ok ? (
          <p className="mt-3 text-xs text-emerald-700">Збережено.</p>
        ) : null}

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block text-xs font-medium text-slate-700">
            Повне імʼя *
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              disabled={!canUpdate}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-[var(--enver-card)] px-3 py-2 text-sm text-[var(--enver-text)] outline-none ring-slate-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-50"
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block text-xs font-medium text-slate-700">
              Імʼя
              <input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                disabled={!canUpdate}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-[var(--enver-card)] px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-50"
              />
            </label>
            <label className="block text-xs font-medium text-slate-700">
              Прізвище
              <input
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                disabled={!canUpdate}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-[var(--enver-card)] px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-50"
              />
            </label>
          </div>
          <label className="block text-xs font-medium text-slate-700">
            Телефон
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={!canUpdate}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-50"
            />
          </label>
          <label className="block text-xs font-medium text-slate-700">
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={!canUpdate}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-50"
            />
          </label>
          <label className="block text-xs font-medium text-slate-700">
            Instagram
            <input
              value={instagramHandle}
              onChange={(e) => setInstagramHandle(e.target.value)}
              disabled={!canUpdate}
              placeholder="@username"
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-50"
            />
          </label>
          <label className="block text-xs font-medium text-slate-700">
            Telegram
            <input
              value={telegramHandle}
              onChange={(e) => setTelegramHandle(e.target.value)}
              disabled={!canUpdate}
              placeholder="@username"
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-50"
            />
          </label>
          <label className="block text-xs font-medium text-slate-700">
            Місто
            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              disabled={!canUpdate}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-50"
            />
          </label>
          <label className="block text-xs font-medium text-slate-700">
            Країна
            <input
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              disabled={!canUpdate}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-50"
            />
          </label>
          <label className="block text-xs font-medium text-slate-700 sm:col-span-2">
            Нотатки
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={!canUpdate}
              rows={4}
              className="mt-1 w-full resize-y rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-50"
            />
          </label>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-[var(--enver-card)] p-4 shadow-sm md:p-5">
        <h2 className="text-sm font-semibold text-[var(--enver-text)]">
          Ліди та угоди
        </h2>
        <p className="mt-1 text-xs text-slate-600">
          Швидкі посилання на картки, де цей контакт фігурує.
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Ліди
            </h3>
            <ul className="mt-2 space-y-2">
              {contact.leads.length === 0 && extraLinked.length === 0 ? (
                <li className="text-xs text-slate-500">Немає привʼязаних лідів.</li>
              ) : null}
              {contact.leads.map((l) => (
                <li key={l.id}>
                  <Link
                    href={`/leads/${l.id}`}
                    className="group flex items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2 text-sm text-slate-800 hover:border-indigo-200 hover:bg-[var(--enver-card)]"
                  >
                    <span className="min-w-0 truncate font-medium">
                      {l.title}
                    </span>
                    <span className="shrink-0 text-[11px] text-slate-500">
                      {l.stage.name}
                    </span>
                    <ExternalLink className="h-3.5 w-3.5 shrink-0 text-slate-400 opacity-0 transition group-hover:opacity-100" />
                  </Link>
                </li>
              ))}
              {extraLinked.map((l) => (
                <li key={l.leadId}>
                  <Link
                    href={`/leads/${l.leadId}`}
                    className="group flex items-center justify-between gap-2 rounded-xl border border-amber-100 bg-amber-50/50 px-3 py-2 text-sm text-slate-800 hover:border-amber-200"
                  >
                    <span className="min-w-0 truncate">
                      {l.title}
                      {l.role ? (
                        <span className="text-slate-500"> · {l.role}</span>
                      ) : null}
                    </span>
                    <ExternalLink className="h-3.5 w-3.5 shrink-0 text-slate-400 opacity-0 transition group-hover:opacity-100" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Угоди
            </h3>
            <ul className="mt-2 space-y-2">
              {contact.deals.length === 0 ? (
                <li className="text-xs text-slate-500">Немає угод як основний контакт.</li>
              ) : null}
              {contact.deals.map((d) => (
                <li key={d.id}>
                  <Link
                    href={`/deals/${d.id}/workspace`}
                    className="group flex items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2 text-sm text-slate-800 hover:border-indigo-200 hover:bg-[var(--enver-card)]"
                  >
                    <span className="min-w-0 truncate font-medium">
                      {d.title}
                    </span>
                    <span className="flex shrink-0 items-center gap-1 text-[11px] text-slate-500">
                      <KanbanSquare className="h-3 w-3" />
                      {d.stage.name}
                    </span>
                    <ExternalLink className="h-3.5 w-3.5 shrink-0 text-slate-400 opacity-0 transition group-hover:opacity-100" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
