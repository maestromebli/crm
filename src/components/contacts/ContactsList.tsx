"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { uk } from "date-fns/locale";
import { Building2, ChevronRight, Phone } from "lucide-react";

import type { ContactListRow } from "../../features/contacts/queries";
import { CONTACT_CATEGORY_LABEL } from "../../lib/contacts/contact-categories";

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
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [lifecycleFilter, setLifecycleFilter] = useState<"all" | "LEAD" | "CUSTOMER">("all");
  const [clientTypeFilter, setClientTypeFilter] = useState<"all" | "COMPANY" | "PERSON">("all");
  const [sortBy, setSortBy] = useState<
    | "updated_desc"
    | "updated_asc"
    | "name_asc"
    | "name_desc"
    | "leads_desc"
    | "deals_desc"
  >("updated_desc");

  const categoryOptions = useMemo(
    () =>
      Object.entries(CONTACT_CATEGORY_LABEL).map(([value, label]) => ({
        value,
        label,
      })),
    [],
  );

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const next = rows.filter((r) => {
      if (categoryFilter !== "all" && r.category !== categoryFilter) return false;
      if (lifecycleFilter !== "all" && r.lifecycle !== lifecycleFilter) return false;
      if (clientTypeFilter === "COMPANY" && r.clientType !== "COMPANY") return false;
      if (
        clientTypeFilter === "PERSON" &&
        r.clientType === "COMPANY"
      ) {
        return false;
      }
      if (!q) return true;
      const haystack = [r.fullName, r.phone, r.email, r.clientName]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });

    next.sort((a, b) => {
      switch (sortBy) {
        case "updated_asc":
          return a.updatedAt.getTime() - b.updatedAt.getTime();
        case "name_asc":
          return a.fullName.localeCompare(b.fullName, "uk");
        case "name_desc":
          return b.fullName.localeCompare(a.fullName, "uk");
        case "leads_desc":
          return b.leadsCount - a.leadsCount;
        case "deals_desc":
          return b.dealsCount - a.dealsCount;
        case "updated_desc":
        default:
          return b.updatedAt.getTime() - a.updatedAt.getTime();
      }
    });

    return next;
  }, [rows, query, categoryFilter, lifecycleFilter, clientTypeFilter, sortBy]);

  return (
    <div className="space-y-3">
      <div className="grid gap-2 rounded-2xl border border-slate-200 bg-[var(--enver-card)] p-3 sm:grid-cols-2 lg:grid-cols-5">
        <label className="block text-[11px] font-medium text-slate-600">
          Пошук
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Імʼя, телефон, email, компанія…"
            className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
          />
        </label>
        <label className="block text-[11px] font-medium text-slate-600">
          Тип контакту
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
          >
            <option value="all">Усі типи</option>
            {categoryOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-[11px] font-medium text-slate-600">
          Статус
          <select
            value={lifecycleFilter}
            onChange={(e) =>
              setLifecycleFilter(e.target.value as "all" | "LEAD" | "CUSTOMER")
            }
            className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
          >
            <option value="all">Усі</option>
            <option value="LEAD">Лід</option>
            <option value="CUSTOMER">Клієнт</option>
          </select>
        </label>
        <label className="block text-[11px] font-medium text-slate-600">
          Замовник
          <select
            value={clientTypeFilter}
            onChange={(e) =>
              setClientTypeFilter(e.target.value as "all" | "COMPANY" | "PERSON")
            }
            className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
          >
            <option value="all">Усі</option>
            <option value="COMPANY">Тільки компанії</option>
            <option value="PERSON">Тільки фізособи</option>
          </select>
        </label>
        <label className="block text-[11px] font-medium text-slate-600">
          Сортування
          <select
            value={sortBy}
            onChange={(e) =>
              setSortBy(
                e.target.value as
                  | "updated_desc"
                  | "updated_asc"
                  | "name_asc"
                  | "name_desc"
                  | "leads_desc"
                  | "deals_desc",
              )
            }
            className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
          >
            <option value="updated_desc">Останні оновлені</option>
            <option value="updated_asc">Найдавніше оновлені</option>
            <option value="name_asc">Імʼя (А-Я)</option>
            <option value="name_desc">Імʼя (Я-А)</option>
            <option value="leads_desc">Більше лідів</option>
            <option value="deals_desc">Більше замовлень</option>
          </select>
        </label>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-[var(--enver-card)] shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/90 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3">Контакт</th>
              <th className="px-4 py-3">Звʼязок</th>
              <th className="px-4 py-3">Тип контакту</th>
              <th className="px-4 py-3">Клієнт</th>
              <th className="px-4 py-3 text-center">Ліди</th>
              <th className="px-4 py-3 text-center">Замовлення</th>
              <th className="px-4 py-3">Оновлено</th>
              <th className="w-10 px-2 py-3" aria-hidden />
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((r) => (
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
                    {CONTACT_CATEGORY_LABEL[r.category]}
                  </span>
                  <p className="mt-1 text-[10px] text-slate-500">
                    {lifecycleLabel(r.lifecycle)}
                  </p>
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
            {filteredRows.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-8 text-center text-sm text-slate-500"
                >
                  Немає контактів за вибраними фільтрами.
                </td>
              </tr>
            ) : null}
          </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
