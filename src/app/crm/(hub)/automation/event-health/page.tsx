import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { uk } from "date-fns/locale";
import { hasEffectivePermission, P } from "@/lib/authz/permissions";
import { getSessionAccess } from "@/lib/authz/session-access";
import { loadEventHealthSnapshot } from "@/lib/events/event-health";

export const metadata: Metadata = {
  title: "Event Health · Automation",
  description: "Моніторинг якості подій DomainEvent та оркестрації.",
};

export default async function EventHealthPage() {
  const access = await getSessionAccess();
  if (!access) redirect("/login");
  const permCtx = {
    realRole: access.realRole,
    impersonatorId: access.impersonatorId,
  };
  const canView =
    hasEffectivePermission(access.permissionKeys, P.AUDIT_LOG_VIEW, permCtx) ||
    hasEffectivePermission(access.permissionKeys, P.SETTINGS_VIEW, permCtx);
  if (!canView) redirect("/crm/dashboard");

  const snapshot = await loadEventHealthSnapshot();

  return (
    <div className="space-y-4">
      <header className="rounded-2xl border border-slate-200 bg-[var(--enver-card)] p-4 shadow-sm">
        <h1 className="text-lg font-semibold text-[var(--enver-text)]">
          Event Health
        </h1>
        <p className="mt-1 text-xs text-slate-600">
          Знімок згенеровано{" "}
          {formatDistanceToNow(new Date(snapshot.generatedAt), {
            addSuffix: true,
            locale: uk,
          })}
          .
        </p>
      </header>

      <section className="grid gap-3 md:grid-cols-3">
        <Card
          title="24h Processed Rate"
          value={`${snapshot.window.last24h.processedRate}%`}
          hint={`${snapshot.window.last24h.processed}/${snapshot.window.last24h.total}`}
        />
        <Card
          title="24h Dedupe Coverage"
          value={`${snapshot.window.last24h.dedupeCoverage}%`}
          hint="Частка подій з dedupeKey"
        />
        <Card
          title="Pending Backlog"
          value={String(snapshot.backlog.pendingTotal)}
          hint={
            snapshot.backlog.oldestPendingAt
              ? `Найстаріша: ${new Date(snapshot.backlog.oldestPendingAt).toLocaleString("uk-UA")}`
              : "Черга пуста"
          }
        />
      </section>

      <section className="rounded-2xl border border-slate-200 bg-[var(--enver-card)] p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-[var(--enver-text)]">Top Types (24h)</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-left text-xs">
            <thead className="text-slate-500">
              <tr>
                <th className="px-2 py-1">Type</th>
                <th className="px-2 py-1">Total</th>
                <th className="px-2 py-1">Pending</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.topTypes24h.map((row) => (
                <tr key={row.type} className="border-t border-slate-100">
                  <td className="px-2 py-1 font-mono">{row.type}</td>
                  <td className="px-2 py-1">{row.total}</td>
                  <td className="px-2 py-1">{row.pending}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-[var(--enver-card)] p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-[var(--enver-text)]">Recent Events</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-left text-xs">
            <thead className="text-slate-500">
              <tr>
                <th className="px-2 py-1">Type</th>
                <th className="px-2 py-1">Entity</th>
                <th className="px-2 py-1">Created</th>
                <th className="px-2 py-1">Processed</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.recent.map((row) => (
                <tr key={row.id} className="border-t border-slate-100">
                  <td className="px-2 py-1 font-mono">{row.type}</td>
                  <td className="px-2 py-1">
                    {(row.entityType ?? "UNKNOWN") + (row.entityId ? `:${row.entityId}` : "")}
                  </td>
                  <td className="px-2 py-1">{new Date(row.createdAt).toLocaleString("uk-UA")}</td>
                  <td className="px-2 py-1">
                    {row.processedAt
                      ? new Date(row.processedAt).toLocaleString("uk-UA")
                      : "pending"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Card(props: { title: string; value: string; hint: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-[var(--enver-card)] p-4 shadow-sm">
      <p className="text-[11px] uppercase tracking-wide text-slate-500">{props.title}</p>
      <p className="mt-1 text-2xl font-semibold text-[var(--enver-text)]">{props.value}</p>
      <p className="mt-1 text-xs text-slate-600">{props.hint}</p>
    </div>
  );
}
