import type { ContactLifecycle } from "@prisma/client";
import { Building2, Mail, MapPin, Phone } from "lucide-react";

import type { ContactDetailRow } from "../../features/contacts/queries";

function lifecycleLabel(lifecycle: ContactLifecycle): string {
  return lifecycle === "CUSTOMER" ? "Клієнт" : "Контакт (лід)";
}

function lifecycleClass(lifecycle: ContactLifecycle): string {
  return lifecycle === "CUSTOMER"
    ? "bg-emerald-50 text-emerald-900 ring-emerald-200/80"
    : "bg-slate-100 text-slate-800 ring-slate-200/80";
}

function initials(name: string): string {
  const p = name.trim().split(/\s+/).filter(Boolean);
  if (p.length >= 2) return (p[0]![0] + p[1]![0]).toUpperCase();
  if (p.length === 1 && p[0]!.length >= 2) return p[0]!.slice(0, 2).toUpperCase();
  return name.slice(0, 2).toUpperCase() || "?";
}

export type ContactHeaderProps = {
  contact: ContactDetailRow;
};

export function ContactHeader({ contact }: ContactHeaderProps) {
  return (
    <div className="mx-auto max-w-7xl px-3 pb-2 pt-4 md:px-6 md:pt-5">
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-[var(--enver-card)] p-4 shadow-sm md:flex-row md:items-start md:gap-6 md:p-5">
        <div
          className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-700 text-lg font-semibold text-white shadow-inner"
          aria-hidden
        >
          {initials(contact.fullName)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight text-[var(--enver-text)] md:text-2xl">
              {contact.fullName}
            </h1>
            <span
              className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ${lifecycleClass(
                contact.lifecycle,
              )}`}
            >
              {lifecycleLabel(contact.lifecycle)}
            </span>
          </div>
          <div className="mt-3 flex flex-col gap-1.5 text-sm text-slate-600 md:flex-row md:flex-wrap md:gap-x-6 md:gap-y-1">
            {contact.phone ? (
              <span className="inline-flex items-center gap-1.5">
                <Phone className="h-4 w-4 shrink-0 text-slate-400" />
                <a href={`tel:${contact.phone}`} className="hover:text-indigo-700">
                  {contact.phone}
                </a>
              </span>
            ) : null}
            {contact.email ? (
              <span className="inline-flex items-center gap-1.5">
                <Mail className="h-4 w-4 shrink-0 text-slate-400" />
                <a
                  href={`mailto:${contact.email}`}
                  className="truncate hover:text-indigo-700"
                >
                  {contact.email}
                </a>
              </span>
            ) : null}
            {(contact.city || contact.country) ? (
              <span className="inline-flex items-center gap-1.5 text-slate-500">
                <MapPin className="h-4 w-4 shrink-0 text-slate-400" />
                {[contact.city, contact.country].filter(Boolean).join(", ")}
              </span>
            ) : null}
          </div>
          {contact.client ? (
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-600">
              <Building2 className="h-3.5 w-3.5 text-slate-400" />
              <span>Клієнт:</span>
              <span className="font-medium text-slate-800">
                {contact.client.name}
              </span>
              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] uppercase text-slate-500">
                {contact.client.type === "COMPANY" ? "ЮО" : "ФОП / ФО"}
              </span>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
