"use client";

import Link from "next/link";
import { format } from "date-fns";
import { uk } from "date-fns/locale";
import { Building2, ChevronRight, Phone } from "lucide-react";

import type { ContactListRow } from "../../features/contacts/queries";

function lifecycleLabel(l: ContactListRow["lifecycle"]): string {
  return l === "CUSTOMER" ? "Клієнт" : "Лід";
}

function lifecycleClass(l: ContactListRow["lifecycle"]): string {
  return l === "CUSTOMER"
    ? "bg-emerald-50 text-emerald-800 ring-emerald-100"
    : "bg-slate-100 text-slate-700 ring-slate-200/80";
}

export type ContactsListProps = {
  rows: ContactListRow[];
};

export function ContactsList({ rows }: ContactsListProps) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-[var(--enver-card)] shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/90 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3">Контакт</th>
              <th className="px-4 py-3">Звʼязок</th>
              <th className="px-4 py-3">Статус</th>
              <th className="px-4 py-3">Клієнт</th>
              <th className="px-4 py-3 text-center">Ліди</th>
              <th className="px-4 py-3 text-center">Угоди</th>
              <th className="px-4 py-3">Оновлено</th>
              <th className="w-10 px-2 py-3" aria-hidden />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.id}
                className="border-b border-slate-50 transition-colors hover:bg-[var(--enver-hover)]/80"
              >
                <td className="px-4 py-3">
                  <Link
                    href={`/contacts/${r.id}`}
                    className="group block font-medium text-[var(--enver-text)] hover:text-indigo-700"
                  >
                    <span className="inline-flex items-center gap-1">
                      {r.fullName}
                      <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-100" />
                    </span>
                  </Link>
                </td>
                <td className="px-4 py-3 text-xs text-slate-600">
                  <div className="flex flex-col gap-0.5">
                    {r.phone ? (
                      <span className="inline-flex items-center gap-1">
                        <Phone className="h-3 w-3 shrink-0 text-slate-400" />
                        {r.phone}
                      </span>
                    ) : null}
                    {r.email ? (
                      <span className="truncate text-slate-500">{r.email}</span>
                    ) : null}
                    {!r.phone && !r.email ? (
                      <span className="text-slate-400">—</span>
                    ) : null}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${lifecycleClass(r.lifecycle)}`}
                  >
                    {lifecycleLabel(r.lifecycle)}
                  </span>
                </td>
                <td className="max-w-[180px] px-4 py-3 text-xs text-slate-600">
                  {r.clientName ? (
                    <span className="inline-flex items-center gap-1 truncate">
                      <Building2 className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                      <span className="truncate">{r.clientName}</span>
                    </span>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-center tabular-nums text-slate-700">
                  {r.leadsCount}
                </td>
                <td className="px-4 py-3 text-center tabular-nums text-slate-700">
                  {r.dealsCount}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">
                  {format(r.updatedAt, "d MMM yyyy, HH:mm", { locale: uk })}
                </td>
                <td className="px-2 py-3">
                  <Link
                    href={`/contacts/${r.id}`}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-800"
                    aria-label={`Відкрити ${r.fullName}`}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
