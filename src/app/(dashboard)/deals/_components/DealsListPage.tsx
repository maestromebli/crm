import type { Metadata } from "next";
import { format } from "date-fns";
import { uk } from "date-fns/locale";
import Link from "next/link";
import {
  KanbanSquare,
  Settings2,
  Sparkles,
  UserPlus,
} from "lucide-react";
import { redirect } from "next/navigation";
import { listDealHubSavedViewsForUser } from "../../../../features/deal-hub/deal-hub-saved-views";
import type { DealHubSavedViewDTO } from "../../../../features/deal-hub/deal-hub-filters";
import {
  listDealsForTable,
  type DealListViewId,
} from "../../../../features/deal-workspace/queries";
import { getSessionAccess } from "../../../../lib/authz/session-access";
import { dealListHrefForView } from "./deal-list-routes";
import { DealsHubClient } from "./DealsHubClient";
import { DealsModuleNav } from "./DealsModuleNav";
import { DEAL_LIST_COPY } from "./deals-list-copy";

export const dealsRootMetadata: Metadata = {
  title: "Угоди · ENVER CRM",
};

type Props = {
  view: DealListViewId;
  defaultLayout?: "table" | "board";
};

export async function DealsListPage({ view, defaultLayout = "table" }: Props) {
  const access = await getSessionAccess();
  if (!access) redirect("/login");
  const { rows, error } = await listDealsForTable(access.ctx, { view });

  let dealHubSavedViews: DealHubSavedViewDTO[] = [];
  if (process.env.DATABASE_URL?.trim()) {
    try {
      dealHubSavedViews = await listDealHubSavedViewsForUser(access.userId);
    } catch {
      dealHubSavedViews = [];
    }
  }

  const copy = DEAL_LIST_COPY[view];
  const serverFiltered =
    view === "won" || view === "lost" || view === "archived";
  const showFilteredEmptyHint =
    rows.length === 0 &&
    !error &&
    view !== "all" &&
    view !== "pipeline";

  const listHref = dealListHrefForView(view);

  return (
    <main className="flex min-h-[calc(100vh-56px)] flex-col bg-[var(--enver-bg)] px-3 py-3 md:px-6 md:py-4">
      <div className="mx-auto w-full max-w-6xl flex-1 space-y-4">
        <nav className="text-[11px] text-[var(--enver-muted)]">
          <Link
            href="/crm/dashboard"
            className="transition hover:text-[var(--enver-text)]"
          >
            Дашборд
          </Link>
          <span className="mx-1.5 text-[var(--enver-border-strong)]">/</span>
          <span className="font-medium text-[var(--enver-text)]">Угоди</span>
          <span className="mx-1.5 text-[var(--enver-border-strong)]">/</span>
          <span className="text-[var(--enver-text-muted)]">{copy.title}</span>
        </nav>

        <header className="relative overflow-hidden rounded-xl border border-[var(--enver-border)] bg-gradient-to-br from-[var(--enver-card)] via-[#1a1b22] to-[#25204a] px-4 py-4 shadow-[var(--enver-shadow)] md:px-6 md:py-5">
          <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-[var(--enver-accent)]/20 blur-3xl" />
          <div className="relative flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="flex gap-4">
              <div className="hidden h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[var(--enver-accent)] text-white shadow-lg shadow-[var(--enver-accent)]/30 sm:flex">
                <KanbanSquare className="h-7 w-7" strokeWidth={1.6} aria-hidden />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--enver-accent-hover)]">
                  Модуль · Продажі
                </p>
                <h1 className="mt-1 text-xl font-bold tracking-tight text-[var(--enver-text)] md:text-2xl">
                  {copy.title}
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--enver-text-muted)]">
                  {copy.description}
                </p>
                <p className="mt-3 flex flex-wrap gap-2 text-[11px] text-[var(--enver-muted)]">
                  <span className="rounded-full border border-[var(--enver-border)] bg-[var(--enver-surface)] px-2 py-0.5">
                    Єдине робоче місце угоди
                  </span>
                  <span className="rounded-full border border-[var(--enver-border)] bg-[var(--enver-surface)] px-2 py-0.5">
                    Таблиця · канбан · CSV
                  </span>
                  <span className="rounded-full border border-[var(--enver-border)] bg-[var(--enver-surface)] px-2 py-0.5">
                    Збережені вигляди
                  </span>
                </p>
              </div>
            </div>
          </div>
        </header>

        <div className="rounded-xl border border-[var(--enver-border)] bg-[var(--enver-card)] px-3 py-2 shadow-[var(--enver-shadow)] md:px-4">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--enver-muted)]">
              Динамічні процеси · швидкий перехід
            </p>
            <div className="flex flex-wrap items-center gap-2 text-[10px]">
              <Link
                href="/leads"
                className="inline-flex items-center gap-1 rounded-full border border-[var(--enver-border)] bg-[var(--enver-surface)] px-2.5 py-1 font-semibold text-[var(--enver-text-muted)] transition hover:bg-[var(--enver-hover)] hover:text-[var(--enver-text)]"
              >
                <UserPlus className="h-3 w-3" aria-hidden />
                Ліди
              </Link>
              <Link
                href="/settings/pipelines"
                className="inline-flex items-center gap-1 rounded-full border border-[var(--enver-border)] bg-[var(--enver-surface)] px-2.5 py-1 font-semibold text-[var(--enver-text-muted)] transition hover:bg-[var(--enver-hover)] hover:text-[var(--enver-text)]"
              >
                <Settings2 className="h-3 w-3" aria-hidden />
                Воронки
              </Link>
              <span className="hidden items-center gap-1 rounded-full border border-[var(--enver-accent)]/30 bg-[var(--enver-accent-soft)] px-2.5 py-1 font-semibold text-[var(--enver-accent-hover)] sm:inline-flex">
                <Sparkles className="h-3 w-3" aria-hidden />
                Робоче місце угоди
              </span>
            </div>
          </div>
          <DealsModuleNav activeHref={listHref} />
        </div>

        {error ? (
          <div className="rounded-xl border border-[var(--enver-warning)]/40 bg-[var(--enver-warning-soft)] px-3 py-2 text-xs text-[var(--enver-text)]">
            {error}
          </div>
        ) : null}

        {showFilteredEmptyHint ? (
          <div className="rounded-xl border border-dashed border-[var(--enver-border)] bg-[var(--enver-card)] px-4 py-10 text-center text-sm text-[var(--enver-text-muted)] shadow-[var(--enver-shadow)]">
            <p>{copy.emptyExtra ?? "Немає угод у цьому вигляді."}</p>
            <p className="mt-2 text-xs text-[var(--enver-muted)]">
              Перегляньте{" "}
              <Link
                href="/deals"
                className="font-semibold text-[var(--enver-accent-hover)] underline-offset-2 hover:underline"
              >
                усі угоди
              </Link>{" "}
              або змініть розділ вище.
            </p>
          </div>
        ) : null}

        {rows.length === 0 && !error && !showFilteredEmptyHint ? (
          <div className="rounded-xl border border-dashed border-[var(--enver-border)] bg-[var(--enver-card)] px-4 py-12 text-center text-sm text-[var(--enver-text-muted)] shadow-[var(--enver-shadow)]">
            <p>
              Немає угод у вашій зоні видимості. Створіть угоду з ліда або
              перевірте підключення до БД після{" "}
              <code className="rounded bg-[var(--enver-hover)] px-1.5 py-0.5 text-xs text-[var(--enver-text)]">
                pnpm db:push
              </code>
              .
            </p>
          </div>
        ) : null}

        {rows.length > 0 ? (
          <>
            <DealsHubClient
              rows={rows.map((r) => ({
                ...r,
                updatedAt: r.updatedAt.toISOString(),
              }))}
              initialLayout={defaultLayout}
              serverFiltered={serverFiltered}
              kpiCountLabel={`Показано · ${copy.title}`}
              savedViewsInitial={dealHubSavedViews}
              savedViewsEnabled={!serverFiltered}
            />
            <p className="text-center text-[10px] text-[var(--enver-muted)]">
              Оновлено:{" "}
              {format(new Date(), "d MMM yyyy HH:mm", { locale: uk })}
            </p>
          </>
        ) : null}
      </div>
    </main>
  );
}
