import type { Metadata } from "next";
import { CalendarShell } from "../../../../features/calendar/components/CalendarShell";
import { demoCalendarEvents } from "../../../../features/calendar/demo-events";
import { loadCalendarEventsFromDb } from "../../../../features/calendar/load-events";
import { presetFromCalendarSlug } from "../../../../features/calendar/route-presets";
import { hasUnrestrictedDataScope } from "../../../../lib/authz/roles";
import { getSessionAccess } from "../../../../lib/authz/session-access";
import {
  buildModulePath,
  pageTitleFromPath,
} from "../../../../lib/navigation-resolve";

type PageProps = {
  params: Promise<{ slug?: string[] }>;
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const pathname = buildModulePath("/calendar", slug);
  return {
    title: pageTitleFromPath(pathname, "Календар · ENVER CRM"),
  };
}

export default async function CalendarPage({ params }: PageProps) {
  const { slug } = await params;
  const preset = presetFromCalendarSlug(slug);
  const access = await getSessionAccess();
  const currentUserId = access?.userId ?? null;

  const dbEvents = access
    ? await loadCalendarEventsFromDb(access.ctx)
    : [];
  const showDemo = access ? hasUnrestrictedDataScope(access.role) : false;
  const events = [...dbEvents, ...(showDemo ? demoCalendarEvents : [])];

  return (
    <div className="space-y-3 md:space-y-4">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--enver-muted)]">
          Календар
        </p>
        <h1 className="text-xl font-semibold tracking-tight text-[var(--enver-text)] md:text-2xl">
          Операційний календар
        </h1>
        <p className="max-w-xl text-xs text-[var(--enver-text-muted)] md:text-sm">
          Заміри, зустрічі, монтажі, виробництво та подальші дії в одному
          календарі ENVER CRM. Підмаршрут з меню задає стартові фільтри.
        </p>
      </div>

      <CalendarShell
        events={events}
        currentUserId={currentUserId}
        routePreset={preset}
      />
    </div>
  );
}
