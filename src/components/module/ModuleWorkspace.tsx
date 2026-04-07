import Link from "next/link";
import { resolveNavContext } from "../../lib/navigation-resolve";

type ModuleWorkspaceProps = {
  pathname: string;
  children?: React.ReactNode;
};

/**
 * Standard workspace shell for module routes (lists, boards, placeholders).
 * Use inside (dashboard) layout — no duplicate AppShell.
 */
export function ModuleWorkspace({
  pathname,
  children,
}: ModuleWorkspaceProps) {
  const ctx = resolveNavContext(pathname);

  const sectionLabel = ctx?.section.label ?? "Модуль";
  const pageLabel =
    ctx?.subItem?.label ?? ctx?.section.label ?? "Розділ";
  const description =
    ctx?.subItem?.description ??
    "Цей розділ у розробці: тут зʼявиться операційний інтерфейс, фільтри та звʼязки з базою даних і API.";

  return (
    <div className="enver-page-shell flex flex-col px-3 py-3 md:px-6 md:py-4">
      <div className="mx-auto w-full max-w-6xl flex-1 space-y-4">
        <nav className="text-[11px] text-[var(--enver-muted)]">
          <Link
            href={ctx?.section.href ?? "/crm/dashboard"}
            className="enver-text-link font-medium no-underline hover:underline"
          >
            {sectionLabel}
          </Link>
          <span className="mx-1.5 text-[var(--enver-border-strong)]">/</span>
          <span className="font-medium text-[var(--enver-text)]">{pageLabel}</span>
        </nav>

        <header className="enver-panel enver-panel--interactive px-4 py-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="enver-eyebrow">ENVER CRM</p>
              <h1 className="mt-1 text-lg font-semibold tracking-tight text-[var(--enver-text)] md:text-xl">
                {pageLabel}
              </h1>
              <p className="mt-1 max-w-2xl text-xs text-[var(--enver-text-muted)] md:text-sm">
                {description}
              </p>
            </div>
            <span className="rounded-xl border border-[var(--enver-warning)]/40 bg-[var(--enver-warning-soft)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-amber-950">
              MVP · у розробці
            </span>
          </div>
        </header>

        <div className="enver-empty px-4 py-8 text-center text-sm text-[var(--enver-text-muted)]">
          {children ?? (
            <p>
              Наступний крок: таблиця / канбан, фільтри, збережені вью та
              звʼязок з API. Маршрут:{" "}
              <code className="rounded-md bg-[var(--enver-hover)] px-1.5 py-0.5 text-xs text-[var(--enver-text)]">
                {pathname}
              </code>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
