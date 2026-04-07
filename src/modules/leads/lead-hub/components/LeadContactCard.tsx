"use client";

import { useState } from "react";
import type { LeadDetailRow } from "../../../../features/leads/queries";
import { normalizePhoneDigits } from "../../../../lib/leads/phone-normalize";

type Props = {
  lead: LeadDetailRow;
  canAssignLead: boolean;
  assignees: { id: string; name: string | null; email: string }[];
  assignBusy: boolean;
  onAssignOwner: (ownerId: string) => void;
};

function telHref(phone: string | null | undefined): string | null {
  if (!phone?.trim()) return null;
  const t = phone.trim();
  if (t.startsWith("+")) return `tel:${t.replace(/\s/g, "")}`;
  const d = normalizePhoneDigits(t);
  if (d.length < 9) return null;
  return `tel:+${d}`;
}

export function LeadContactCard({
  lead,
  canAssignLead,
  assignees,
  assignBusy,
  onAssignOwner,
}: Props) {
  const [copied, setCopied] = useState(false);
  const name =
    lead.contact?.fullName?.trim() ||
    lead.contactName?.trim() ||
    "—";
  const phone = lead.contact?.phone?.trim() || lead.phone?.trim() || null;
  const email = lead.contact?.email?.trim() || lead.email?.trim() || null;
  const ig = lead.contact?.instagramHandle?.trim();
  const tg = lead.contact?.telegramHandle?.trim();
  const tel = telHref(phone);

  const copyPhone = async () => {
    if (!phone) return;
    try {
      await navigator.clipboard.writeText(phone);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* noop */
    }
  };

  return (
    <section
      id="lead-contact"
      className="rounded-2xl border border-slate-200 bg-[var(--enver-card)] p-3 shadow-sm"
    >
      <h3 className="text-xs font-semibold text-[var(--enver-text)]">Контакт</h3>
      <dl className="mt-2 space-y-1.5 text-xs">
        <div>
          <dt className="text-[10px] uppercase text-slate-400">Імʼя</dt>
          <dd className="font-medium text-[var(--enver-text)]">{name}</dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase text-slate-400">Телефон</dt>
          <dd className="flex flex-wrap items-center gap-2">
            <span className="text-slate-800">{phone ?? "—"}</span>
            {phone ? (
              <>
                <button
                  type="button"
                  onClick={() => void copyPhone()}
                  className="text-[11px] text-slate-600 underline"
                >
                  {copied ? "Скопійовано" : "Копіювати"}
                </button>
                {tel ? (
                  <a
                    href={tel}
                    className="text-[11px] font-medium text-emerald-700 underline"
                  >
                    Дзвінок
                  </a>
                ) : null}
              </>
            ) : null}
          </dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase text-slate-400">Месенджери</dt>
          <dd className="text-slate-700">
            {[ig ? `IG: @${ig.replace(/^@/, "")}` : null, tg ? `TG: @${tg.replace(/^@/, "")}` : null]
              .filter(Boolean)
              .join(" · ") || "—"}
          </dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase text-slate-400">Email</dt>
          <dd className="break-all text-slate-800">{email ?? "—"}</dd>
        </div>
      </dl>

      {canAssignLead ? (
        <div className="mt-3 border-t border-slate-100 pt-3">
          <p className="text-[10px] font-medium uppercase text-slate-400">
            Відповідальний
          </p>
          <select
            disabled={assignBusy}
            className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
            value={lead.ownerId}
            onChange={(e) => onAssignOwner(e.target.value)}
          >
            <option value={lead.ownerId}>
              {lead.owner.name?.trim() || lead.owner.email}
            </option>
            {assignees
              .filter((u) => u.id !== lead.ownerId)
              .map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name?.trim() || u.email}
                </option>
              ))}
          </select>
        </div>
      ) : null}
    </section>
  );
}
