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
  listDealBoardStages,
  listDealsForTable,
  type DealListViewId,
} from "../../../../features/deal-workspace/queries";
import { getSessionAccess } from "../../../../lib/authz/session-access";
import { dealListHrefForView } from "./deal-list-routes";
import { DealsHubClient } from "./DealsHubClient";
import { DealsModuleNav } from "./DealsModuleNav";
import { DEAL_LIST_COPY } from "./deals-list-copy";

export const dealsRootMetadata: Metadata = {
  title: "Замовлення · ENVER CRM",
};

type Props = {
  view: DealListViewId;
  defaultLayout?: "table" | "board";
};

export async function DealsListPage({ view, defaultLayout = "table" }: Props) {
  const access = await getSessionAccess();
  if (!access) redirect("/login");
  const { rows, error } = await listDealsForTable(access.ctx, { view });

  const boardStages =
    !error && process.env.DATABASE_URL?.trim()
      ? await listDealBoardStages(rows.map((r) => ({ pipelineId: r.pipelineId })))
      : [];

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

  const showHub =
    !error &&
    !showFilteredEmptyHint &&
    (rows.length > 0 || view === "pipeline");
  const stagger = (index: number) => ({
    animationDelay: `${Math.min(index, 10) * 45}ms`,
  });

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
          <span className="mx-1.5 text-[var(--enver-muted)]">/</span>
          <span className="font-medium text-[var(--enver-text)]">Замовлення</span>
          <span className="mx-1.5 text-[var(--enver-muted)]">/</span>
          <span className="text-[var(--enver-text-muted)]">{copy.title}</span>
        </nav>

        <header
          className="enver-card-appear relative overflow-hidden rounded-xl border border-[var(--enver-border)] bg-[var(--enver-card)] px-4 py-4 md:px-6 md:py-5"
          style={stagger(0)}
        >
          <div className="relative flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="flex gap-4">
              <div className="hidden h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[var(--enver-surface)] text-[var(--enver-text-muted)] sm:flex">
                <KanbanSquare className="h-7 w-7" strokeWidth={1.6} aria-hidden />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--enver-muted)]">
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
                    Єдине робоче місце замовлення
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

        <div
          className="enver-card-appear rounded-xl border border-[var(--enver-border)] bg-[var(--enver-card)] px-3 py-2 shadow-[var(--enver-shadow)] md:px-4"
          style={stagger(1)}
        >
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--enver-muted)]">
              Динамічні процеси · швидкий перехід
            </p>
            <div className="flex flex-wrap items-center gap-2 text-[10px]">
              <Link
                href="/leads"
                className="enver-cta enver-cta-xs enver-cta-secondary enver-cta-pill"
              >
                <UserPlus className="h-3 w-3" aria-hidden />
                Ліди
              </Link>
              <Link
                href="/settings/pipelines"
                className="enver-cta enver-cta-xs enver-cta-secondary enver-cta-pill"
              >
                <Settings2 className="h-3 w-3" aria-hidden />
                Воронки
              </Link>
              <span className="enver-cta enver-cta-xs enver-cta-primary enver-cta-pill hidden sm:inline-flex">
                <Sparkles className="h-3 w-3" aria-hidden />
                Робоче місце замовлення
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
          <div
            className="enver-card-appear rounded-xl border border-dashed border-[var(--enver-border)] bg-[var(--enver-card)] px-4 py-10 text-center text-sm text-[var(--enver-text-muted)] shadow-[var(--enver-shadow)]"
            style={stagger(2)}
          >
            <p>{copy.emptyExtra ?? "Немає замовлень у цьому вигляді."}</p>
            <p className="mt-2 text-xs text-[var(--enver-muted)]">
              Перегляньте{" "}
              <Link
                href="/deals"
                className="font-semibold text-[var(--enver-accent)] underline-offset-2 hover:text-[var(--enver-accent-hover)] hover:underline"
              >
                усі замовлення
              </Link>{" "}
              або змініть розділ вище.
            </p>
          </div>
        ) : null}

        {rows.length === 0 &&
        !error &&
        !showFilteredEmptyHint &&
        view !== "pipeline" ? (
          <div
            className="enver-card-appear rounded-xl border border-dashed border-[var(--enver-border)] bg-[var(--enver-card)] px-4 py-12 text-center text-sm text-[var(--enver-text-muted)] shadow-[var(--enver-shadow)]"
            style={stagger(2)}
          >
            <p>Немає замовлень у вашій зоні видимості.</p>
            <p className="mt-2 text-xs text-[var(--enver-muted)]">
              Почніть з{" "}
              <Link
                href="/leads"
                className="font-semibold text-[var(--enver-accent)] underline-offset-2 hover:text-[var(--enver-accent-hover)] hover:underline"
              >
                лідів
              </Link>{" "}
              або відкрийте{" "}
              <Link
                href="/deals/pipeline"
                className="font-semibold text-[var(--enver-accent)] underline-offset-2 hover:text-[var(--enver-accent-hover)] hover:underline"
              >
                воронку замовлень
              </Link>{" "}
              для швидкої навігації.
            </p>
          </div>
        ) : null}

        {showHub ? (
          <div className="enver-card-appear space-y-2" style={stagger(3)}>
            <DealsHubClient
              rows={rows.map((r) => ({
                ...r,
                updatedAt: r.updatedAt.toISOString(),
              }))}
              initialLayout={defaultLayout}
              serverFiltered={serverFiltered}
              kpiCountLabel={`Показано · ${copy.title}`}
              boardStages={boardStages}
              savedViewsInitial={dealHubSavedViews}
              savedViewsEnabled={!serverFiltered}
            />
            <p className="text-center text-[10px] text-[var(--enver-muted)]">
              Оновлено:{" "}
              {format(new Date(), "d MMM yyyy HH:mm", { locale: uk })}
            </p>
          </div>
        ) : null}
      </div>
    </main>
  );
}
