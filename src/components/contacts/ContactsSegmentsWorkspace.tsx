"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Loader2, Send, Upload } from "lucide-react";
import type { ContactCategory } from "@prisma/client";
import type { ContactListRow } from "../../features/contacts/queries";
import { CONTACT_CATEGORY_LABEL } from "../../lib/contacts/contact-categories";

type ContactsSegmentsWorkspaceProps = {
  rows: ContactListRow[];
};

export function ContactsSegmentsWorkspace({ rows }: ContactsSegmentsWorkspaceProps) {
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [channel, setChannel] = useState<"telegram" | "whatsapp">("telegram");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const selectedIds = useMemo(
    () => Object.keys(selected).filter((id) => selected[id]),
    [selected],
  );
  const grouped = useMemo(() => {
    const map = new Map<ContactCategory, ContactListRow[]>();
    for (const row of rows) {
      const arr = map.get(row.category) ?? [];
      arr.push(row);
      map.set(row.category, arr);
    }
    return [...map.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [rows]);

  function toggle(id: string) {
    setSelected((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  async function handleImport(formData: FormData) {
    setImporting(true);
    setResult(null);
    try {
      const res = await fetch("/api/contacts/import", {
        method: "POST",
        body: formData,
      });
      const json = (await res.json().catch(() => null)) as
        | { error?: string; created?: number; updated?: number; skipped?: number }
        | null;
      if (!res.ok) throw new Error(json?.error || "Помилка імпорту");
      setResult(
        `Імпорт завершено: створено ${json?.created ?? 0}, оновлено ${json?.updated ?? 0}, пропущено ${json?.skipped ?? 0}.`,
      );
    } catch (e) {
      setResult(e instanceof Error ? e.message : "Помилка імпорту");
    } finally {
      setImporting(false);
    }
  }

  async function handleBroadcast(toAll: boolean) {
    if (!message.trim()) return;
    setSending(true);
    setResult(null);
    try {
      const res = await fetch("/api/contacts/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel,
          message: message.trim(),
          toAll,
          contactIds: toAll ? undefined : selectedIds,
        }),
      });
      const json = (await res.json().catch(() => null)) as
        | { error?: string; sent?: number; failed?: number; total?: number }
        | null;
      if (!res.ok) throw new Error(json?.error || "Помилка розсилки");
      setResult(
        `Розсилка завершена: відправлено ${json?.sent ?? 0} з ${json?.total ?? 0}, помилок ${json?.failed ?? 0}.`,
      );
    } catch (e) {
      setResult(e instanceof Error ? e.message : "Помилка розсилки");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-slate-200 bg-[var(--enver-card)] p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-[var(--enver-text)]">Імпорт контактів</h2>
        <p className="mt-1 text-xs text-slate-600">
          Завантажте CSV/XLSX з колонками: імʼя, телефон, email, тип контакту, компанія.
        </p>
        <form
          className="mt-3 flex flex-wrap items-center gap-2"
          action={(fd) => {
            void handleImport(fd);
          }}
        >
          <input
            type="file"
            name="file"
            accept=".csv,.xlsx,.xls"
            className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
            required
          />
          <button
            type="submit"
            disabled={importing}
            className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
          >
            {importing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            Імпортувати
          </button>
        </form>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-[var(--enver-card)] p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-[var(--enver-text)]">Розсилка</h2>
        <p className="mt-1 text-xs text-slate-600">
          Надішліть повідомлення всім контактам або вибраним у списку нижче.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-[160px_1fr]">
          <select
            value={channel}
            onChange={(e) => setChannel(e.target.value as "telegram" | "whatsapp")}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
          >
            <option value="telegram">Telegram</option>
            <option value="whatsapp">WhatsApp</option>
          </select>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            placeholder="Текст повідомлення..."
            className="resize-y rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void handleBroadcast(true)}
            disabled={sending || !message.trim()}
            className="inline-flex items-center gap-2 rounded-full bg-indigo-600 px-4 py-2 text-xs font-medium text-white disabled:opacity-50"
          >
            {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            Розіслати всім
          </button>
          <button
            type="button"
            onClick={() => void handleBroadcast(false)}
            disabled={sending || !message.trim() || selectedIds.length === 0}
            className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-xs font-medium text-white disabled:opacity-50"
          >
            {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            Розіслати вибраним ({selectedIds.length})
          </button>
        </div>
      </section>

      {result ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
          {result}
        </div>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-[var(--enver-card)] p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-[var(--enver-text)]">
          Групування за типом контакту
        </h2>
        <div className="mt-4 space-y-4">
          {grouped.map(([category, items]) => (
            <div key={category} className="rounded-xl border border-slate-100">
              <div className="flex items-center justify-between bg-slate-50 px-3 py-2">
                <p className="text-xs font-semibold text-slate-700">
                  {CONTACT_CATEGORY_LABEL[category]}
                </p>
                <span className="text-xs text-slate-500">{items.length}</span>
              </div>
              <ul className="divide-y divide-slate-100">
                {items.map((item) => (
                  <li key={item.id} className="flex items-center justify-between gap-2 px-3 py-2">
                    <label className="inline-flex items-center gap-2 text-sm text-slate-800">
                      <input
                        type="checkbox"
                        checked={Boolean(selected[item.id])}
                        onChange={() => toggle(item.id)}
                      />
                      <span>{item.fullName}</span>
                    </label>
                    <Link
                      href={`/contacts/${item.id}`}
                      className="text-xs font-medium text-indigo-700 hover:underline"
                    >
                      Відкрити
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

