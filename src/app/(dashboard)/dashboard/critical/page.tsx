import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CriticalAlertsPanel } from "../../../../components/dashboard/CriticalAlertsPanel";
import { ModuleWorkspace } from "../../../../components/module/ModuleWorkspace";
import {
  getExecutiveDashboardPerms,
  getDashboardPerms,
  loadDashboardSnapshot,
} from "../../../../features/dashboard/queries";
import { loadExecutiveDashboard } from "../../../../features/crm-dashboard/load-executive-dashboard";
import { settingsUsersListWhere } from "../../../../lib/authz/data-scope";
import { getSessionAccess } from "../../../../lib/authz/session-access";
import { listCommunicationsAlerts } from "../../../../lib/messaging/communications-health";
import { prisma } from "../../../../lib/prisma";

export const metadata: Metadata = {
  title: "Критичні пункти · ENVER CRM",
};

export default async function DashboardCriticalPage() {
  const access = await getSessionAccess();
  if (!access) redirect("/login");
  const perms = getDashboardPerms(access);
  const snapshot = await loadDashboardSnapshot(access, perms);
  const execPerms = getExecutiveDashboardPerms(access);
  const executiveData = await loadExecutiveDashboard(
    access,
    execPerms,
    access.role,
    {
      financeRange: "week",
      trendRange: "30d",
      trendMetric: "revenue",
      savedView: "issues",
      managerId: null,
      source: null,
      dealStatus: null,
      q: "",
    },
  );

  const where = await settingsUsersListWhere(prisma, {
    id: access.userId,
    role: access.dbRole,
  });
  const users = await prisma.user.findMany({
    where,
    select: { id: true, name: true, email: true },
    take: 500,
  });
  const labels = new Map(users.map((u) => [u.id, u.name?.trim() || u.email]));
  const alertsRaw = await listCommunicationsAlerts({
    userIds: users.map((u) => u.id),
    unreadOnly: false,
  });
  const alerts = alertsRaw.map((a) => ({
    ...a,
    userLabel: labels.get(a.userId) ?? a.userId,
  }));
  const behaviorAttentionItems = executiveData.behavior.alerts.map((item) => ({
    id: item.id,
    label: item.label,
    detail: item.detail,
    severity: item.severity,
    href: item.href,
  }));
  const unifiedAttention = [...snapshot.attention, ...behaviorAttentionItems];

  return (
    <ModuleWorkspace pathname="/dashboard/critical">
      <div className="grid gap-4 text-left lg:grid-cols-[1fr_1fr]">
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <h2 className="text-sm font-semibold text-amber-900">Критичні пункти CRM</h2>
          {unifiedAttention.length === 0 ? (
            <p className="mt-2 text-xs text-amber-800">Немає критичних пунктів.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {unifiedAttention.map((item) => {
                const inner = (
                  <>
                    <p className="font-medium">
                      {item.label}
                      {item.severity === "high" ? (
                        <span className="ml-1 rounded bg-rose-100 px-1 py-0.5 text-[10px] text-rose-800">
                          високий
                        </span>
                      ) : null}
                    </p>
                    <p className="text-[11px] text-slate-600">{item.detail}</p>
                  </>
                );
                if (item.href) {
                  return (
                    <li key={item.id}>
                      <Link
                        href={item.href}
                        className="block rounded-md border border-amber-200 bg-[var(--enver-card)] px-3 py-2 text-xs text-slate-800 transition hover:bg-amber-50"
                      >
                        {inner}
                      </Link>
                    </li>
                  );
                }
                return (
                  <li
                    key={item.id}
                    className="rounded-md border border-amber-200 bg-[var(--enver-card)] px-3 py-2 text-xs text-slate-800"
                  >
                    {inner}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
        <CriticalAlertsPanel initialAlerts={alerts} />
      </div>
    </ModuleWorkspace>
  );
}
