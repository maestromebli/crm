import { BookUser } from "lucide-react";

import type { ContactListView } from "../../lib/contacts-route";
import type { ContactListRow } from "../../features/contacts/queries";
import { ContactsList } from "./ContactsList";

export type ContactsPageProps = {
  title: string;
  description?: string;
  view: ContactListView;
  rows: ContactListRow[];
  hint: string | null;
};

const PLACEHOLDER_COPY: Record<
  "segments" | "activity",
  { title: string; body: string }
> = {
  segments: {
    title: "Сегменти аудиторії",
    body: "Тут зʼявиться конструктор сегментів (за джерелом, стадією, LTV, тегами). Поки що використовуйте фільтри «Клієнти», «Партнери» або пошук у картці ліда.",
  },
  activity: {
    title: "Зведена активність",
    body: "Ми додамо узагальнений таймлайн дзвінків, листів і змін по всіх контактах. Зараз історія доступна в картці конкретного контакта на вкладці «Активність».",
  },
};

export function ContactsPage({
  title,
  description,
  view,
  rows,
  hint,
}: ContactsPageProps) {
  const isPlaceholder = view === "segments" || view === "activity";
  const ph = isPlaceholder ? PLACEHOLDER_COPY[view] : null;

  return (
    <div className="flex min-h-[calc(100vh-56px)] flex-col bg-slate-50 px-3 py-3 md:px-6 md:py-4">
      <div className="mx-auto w-full max-w-6xl flex-1 space-y-4">
        <header className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50/90 px-4 py-4 shadow-sm md:flex-row md:items-center md:justify-between md:px-5">
          <div className="flex gap-3">
            <div className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white sm:flex">
              <BookUser className="h-6 w-6" strokeWidth={1.75} aria-hidden />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                Модуль · Контакти
              </p>
              <h1 className="mt-0.5 text-lg font-semibold tracking-tight text-[var(--enver-text)] md:text-xl">
                {title}
              </h1>
              {description ? (
                <p className="mt-1 max-w-2xl text-xs leading-relaxed text-slate-600 md:text-sm">
                  {description}
                </p>
              ) : (
                <p className="mt-1 max-w-2xl text-xs text-slate-500">
                  Єдиний профіль людини: ліди, угоди, діалоги та файли в одному
                  місці.
                </p>
              )}
            </div>
          </div>
        </header>

        {hint ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            {hint}
          </div>
        ) : null}

        {isPlaceholder && ph ? (
          <div className="rounded-2xl border border-indigo-100 bg-indigo-50/60 px-4 py-5 text-sm text-indigo-950 shadow-sm">
            <p className="font-semibold">{ph.title}</p>
            <p className="mt-2 text-indigo-900/90">{ph.body}</p>
          </div>
        ) : null}

        {!isPlaceholder && rows.length === 0 && !hint ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-[var(--enver-card)] px-4 py-12 text-center shadow-sm">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
              <BookUser className="h-7 w-7" strokeWidth={1.5} aria-hidden />
            </div>
            <p className="mt-4 text-sm font-medium text-slate-800">
              Контактів за цим фільтром немає
            </p>
            <p className="mx-auto mt-2 max-w-sm text-xs leading-relaxed text-slate-500">
              Спробуйте «Усі контакти» або створіть лід з картки — контакт
              зʼявиться автоматично під час роботи.
            </p>
          </div>
        ) : null}

        {!isPlaceholder && rows.length > 0 ? <ContactsList rows={rows} /> : null}
      </div>
    </div>
  );
}
