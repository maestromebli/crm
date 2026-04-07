import type { ResolvedPageContext } from "../types";
import type { AssistantQuickAction } from "../types";
import type { EffectiveRole } from "../../../lib/authz/roles";

function nav(
  partial: Omit<AssistantQuickAction, "actionType">,
): AssistantQuickAction {
  return { ...partial, actionType: "navigate" };
}

export function buildQuickActions(
  ctx: ResolvedPageContext,
  role: EffectiveRole,
): AssistantQuickAction[] {
  const base: AssistantQuickAction[] = [
    nav({
      id: "calendar",
      label: "Запланувати замір",
      href: "/calendar",
    }),
    nav({
      id: "pipeline_deals",
      label: "Воронка угод",
      href: "/deals/pipeline",
    }),
    nav({
      id: "tasks_today",
      label: "Задачі на сьогодні",
      href: "/today",
    }),
  ];

  if (ctx.kind === "lead_detail" && ctx.leadId) {
    base.unshift(
      nav({
        id: "lead_estimate",
        label: "Розрахунок у ліді",
        href: `/leads/${ctx.leadId}/estimate`,
      }),
    );
    base.unshift(
      nav({
        id: "lead_tasks_tab",
        label: "Задачі ліда",
        href: `/leads/${ctx.leadId}/tasks`,
      }),
    );
  }

  if (
    (ctx.kind === "deal_detail" || ctx.kind === "deal_workspace") &&
    ctx.dealId
  ) {
    base.unshift(
      nav({
        id: "deal_workspace",
        label: "Робоче місце угоди",
        href: `/deals/${ctx.dealId}/workspace`,
      }),
    );
    base.unshift(
      nav({
        id: "deal_tasks_tab",
        label: "Задачі угоди",
        href: `/deals/${ctx.dealId}/workspace?tab=tasks`,
      }),
    );
  }

  if (
    role === "HEAD_MANAGER" ||
    role === "DIRECTOR" ||
    role === "SUPER_ADMIN"
  ) {
    base.push(
      nav({
        id: "team_overview",
        label: "Команда та навантаження",
        href: "/dashboard/team",
      }),
    );
  }

  if (role === "DIRECTOR" || role === "SUPER_ADMIN") {
    base.push(
      nav({
        id: "reports",
        label: "Звіти та ризики",
        href: "/reports/sales",
      }),
    );
  }

  return base.slice(0, 8);
}
