import type {
  DashboardPerms,
  DashboardSnapshot,
} from "../../dashboard/queries";

/**
 * Компактний контекст для AI brief на дашборді (тільки те, що вже завантажено для UI).
 */
export function buildDashboardBriefContext(
  snapshot: DashboardSnapshot,
  perms: DashboardPerms,
): string {
  const attention = snapshot.attention.slice(0, 12).map((a) => ({
    id: a.id,
    type: a.type,
    label: a.label,
    severity: a.severity,
    detail: a.detail,
  }));

  const agenda = snapshot.agenda.slice(0, 10).map((x) => ({
    time: x.time,
    label: x.label,
    type: x.type,
    context: x.context,
  }));

  const funnel = snapshot.funnel.slice(0, 12).map((f) => ({
    name: f.name,
    count: f.count,
  }));

  const payload = {
    perms: {
      leads: perms.leadsView,
      deals: perms.dealsView,
      tasks: perms.tasksView,
      calendar: perms.calendarView,
      notifications: perms.notificationsView,
    },
    kpis: {
      newLeads24h: snapshot.kpiNewLeads24h,
      newLeadsPrev24h: snapshot.kpiNewLeadsPrev24h,
      openDeals: snapshot.kpiOpenDeals,
      dealsInContract: snapshot.kpiDealsInContractStage,
      overdueTasks: snapshot.kpiOverdueTasks,
      installationUpcoming: snapshot.installationUpcoming,
      productionRisk: snapshot.productionRisk,
      signatureStaleCount: snapshot.signatureStaleCount,
    },
    attention,
    agenda,
    funnel,
    signatureStale: snapshot.signatureStaleDeals.slice(0, 8),
    teamLoad: snapshot.teamLoad.slice(0, 12).map((m) => ({
      userId: m.userId,
      name: m.name,
      dealsOpen: m.dealsOpen,
      tasksOpen: m.tasksOpen,
    })),
    handoffTiles: snapshot.handoffTiles.slice(0, 8).map((h) => ({
      key: h.key,
      label: h.label,
      value: h.value,
      hint: h.hint,
      tone: h.tone,
    })),
  };

  return JSON.stringify(payload, null, 0);
}
