import Link from "next/link";
import { format } from "date-fns";
import { uk } from "date-fns/locale";
import { ExternalLink, FileText, KanbanSquare } from "lucide-react";

import type {
  ContactAttachmentRow,
  ContactDetailDeal,
  ContactLeadMessageRow,
  ContactTaskRow,
} from "../../../features/contacts/queries";

export function ContactDealsTab({ deals }: { deals: ContactDetailDeal[] }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-[var(--enver-card)] p-4 shadow-sm md:p-5">
      <h2 className="text-sm font-semibold text-[var(--enver-text)]">Замовлення</h2>
      <p className="mt-1 text-xs text-slate-600">
        Замовлення, де цей контакт вказаний як основний.
      </p>
      {deals.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">Немає замовлень.</p>
      ) : (
        <div className="mt-4 overflow-hidden rounded-xl border border-slate-100">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2">Назва</th>
                <th className="px-3 py-2">Клієнт</th>
                <th className="px-3 py-2">Стадія</th>
                <th className="px-3 py-2">Статус</th>
                <th className="w-10 px-2 py-2" aria-hidden />
              </tr>
            </thead>
            <tbody>
              {deals.map((d) => (
                <tr key={d.id} className="border-t border-slate-100">
                  <td className="px-3 py-2.5 font-medium text-[var(--enver-text)]">
                    {d.title}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-slate-600">
                    {d.client.name}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-slate-700">
                    {d.stage.name}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-slate-600">
                    {d.status}
                  </td>
                  <td className="px-2 py-2.5">
                    <Link
                      href={`/deals/${d.id}/workspace`}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-800"
                      aria-label="Відкрити замовлення"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export function ContactConversationsTab({
  messages,
}: {
  messages: ContactLeadMessageRow[];
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-[var(--enver-card)] p-4 shadow-sm md:p-5">
      <h2 className="text-sm font-semibold text-[var(--enver-text)]">Діалоги</h2>
      <p className="mt-1 text-xs text-slate-600">
        Повідомлення та нотатки у лідах, де цей контакт фігурує (основний або
        додатковий).
      </p>
      {messages.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">
          Поки немає записів у діалогах повʼязаних лідів.
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {messages.map((m) => (
            <li
              key={m.id}
              className="rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
                <Link
                  href={`/leads/${m.lead.id}/messages`}
                  className="font-medium text-indigo-700 hover:underline"
                >
                  {m.lead.title}
                </Link>
                <time dateTime={m.createdAt.toISOString()}>
                  {format(m.createdAt, "d MMM yyyy, HH:mm", { locale: uk })}
                </time>
              </div>
              <p className="mt-1 text-[11px] text-slate-500">
                {m.channel} · {m.interactionKind} · {m.author}
              </p>
              <p className="mt-2 whitespace-pre-wrap text-sm text-slate-800">
                {m.body}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function taskHref(t: ContactTaskRow): string {
  if (t.entityType === "LEAD") {
    return `/leads/${t.entityId}/tasks`;
  }
  return `/deals/${t.entityId}/workspace?tab=tasks`;
}

export function ContactTasksTab({ tasks }: { tasks: ContactTaskRow[] }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-[var(--enver-card)] p-4 shadow-sm md:p-5">
      <h2 className="text-sm font-semibold text-[var(--enver-text)]">Задачі</h2>
      <p className="mt-1 text-xs text-slate-600">
        Задачі з повʼязаних лідів та замовлень (агреговано).
      </p>
      {tasks.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">Немає задач.</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {tasks.map((t) => (
            <li key={t.id}>
              <Link
                href={taskHref(t)}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-100 bg-[var(--enver-card)] px-3 py-2.5 text-sm shadow-sm transition hover:border-indigo-200"
              >
                <span className="font-medium text-[var(--enver-text)]">{t.title}</span>
                <span className="flex items-center gap-2 text-[11px] text-slate-500">
                  <span className="rounded bg-slate-100 px-1.5 py-0.5">
                    {t.entityType}
                  </span>
                  <span>{t.status}</span>
                  {t.dueAt ? (
                    <span>
                      до {format(t.dueAt, "d MMM", { locale: uk })}
                    </span>
                  ) : null}
                  <KanbanSquare className="h-3.5 w-3.5" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function ContactFilesTab({
  attachments,
  canDownload,
}: {
  attachments: ContactAttachmentRow[];
  canDownload: boolean;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-[var(--enver-card)] p-4 shadow-sm md:p-5">
      <h2 className="text-sm font-semibold text-[var(--enver-text)]">Файли</h2>
      <p className="mt-1 text-xs text-slate-600">
        Файли, завантажені безпосередньо до контакту (сутність «Контакт»).
      </p>
      {attachments.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">
          Поки немає файлів на картці контакту. Файли лідів дивіться у відповідних
          лідах.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-100">
          {attachments.map((a) => (
            <li
              key={a.id}
              className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-sm"
            >
              <span className="inline-flex min-w-0 items-center gap-2">
                <FileText className="h-4 w-4 shrink-0 text-slate-400" />
                <span className="truncate font-medium text-slate-800">
                  {a.fileName}
                </span>
              </span>
              <span className="text-[11px] text-slate-500">{a.category}</span>
              {canDownload ? (
                <a
                  href={`/api/attachments/${a.id}/download`}
                  className="text-xs font-medium text-indigo-700 hover:underline"
                >
                  Завантажити
                </a>
              ) : (
                <span className="text-xs text-slate-400">Немає доступу</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
