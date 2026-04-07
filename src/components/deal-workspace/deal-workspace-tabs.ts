import type { DealWorkspaceTabId } from "../../features/deal-workspace/types";

/** Підписи для підвкладок усередині групи. */
export const DEAL_WORKSPACE_TAB_LABELS: Record<DealWorkspaceTabId, string> = {
  overview: "Огляд",
  messages: "Комунікація",
  qualification: "Кваліфікація",
  measurement: "Замір",
  proposal: "КП",
  estimate: "Смета",
  contract: "Договір",
  payment: "Оплата",
  finance: "Фінанси та закупівлі",
  files: "Файли",
  tasks: "Задачі",
  handoff: "Передача",
  production: "Виробництво",
  activity: "Журнал",
};

/** 4 групи замість 13 окремих табів у головній навігації. */
export const DEAL_WORKSPACE_TAB_GROUPS: Array<{
  id: string;
  label: string;
  defaultTab: DealWorkspaceTabId;
  tabs: readonly DealWorkspaceTabId[];
}> = [
  {
    id: "sales",
    label: "Продаж",
    defaultTab: "overview",
    tabs: ["overview", "messages", "qualification", "measurement", "proposal"],
  },
  {
    id: "work",
    label: "Смета і задачі",
    defaultTab: "estimate",
    tabs: ["estimate", "tasks"],
  },
  {
    id: "docs",
    label: "Угода",
    defaultTab: "contract",
    tabs: ["contract", "payment", "finance", "files"],
  },
  {
    id: "after",
    label: "Після продажу",
    defaultTab: "activity",
    tabs: ["handoff", "production", "activity"],
  },
];

export function workspaceGroupForTab(
  tab: DealWorkspaceTabId,
): (typeof DEAL_WORKSPACE_TAB_GROUPS)[number] {
  return (
    DEAL_WORKSPACE_TAB_GROUPS.find((g) => g.tabs.includes(tab)) ??
    DEAL_WORKSPACE_TAB_GROUPS[0]
  );
}

/** Плоский список (зворотна сумісність, плейсхолдери). */
export const DEAL_WORKSPACE_TABS: Array<{
  id: DealWorkspaceTabId;
  label: string;
}> = (Object.keys(DEAL_WORKSPACE_TAB_LABELS) as DealWorkspaceTabId[]).map(
  (id) => ({ id, label: DEAL_WORKSPACE_TAB_LABELS[id] }),
);

export function isDealWorkspaceTabId(
  v: string | undefined,
): v is DealWorkspaceTabId {
  if (!v) return false;
  return v in DEAL_WORKSPACE_TAB_LABELS;
}
