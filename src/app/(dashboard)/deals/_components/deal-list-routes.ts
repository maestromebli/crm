import type { DealListViewId } from "../../../../features/deal-workspace/queries";

/** Канонічні маршрути списку замовлень (бокове меню + горизонтальна навігація модуля). */
export const DEAL_LIST_ROUTES: Array<{
  href: string;
  view: DealListViewId;
  label: string;
  description?: string;
}> = [
  {
    href: "/deals",
    view: "all",
    label: "Усі",
    description: "Повний список у зоні видимості",
  },
  {
    href: "/deals/pipeline",
    view: "pipeline",
    label: "Воронка",
    description: "Таблиця або канбан за стадіями",
  },
  {
    href: "/deals/active",
    view: "active",
    label: "Активні",
    description: "Статус «Відкрита»",
  },
  {
    href: "/deals/waiting-measure",
    view: "waiting_measure",
    label: "Замір",
    description: "Очікують виїзду",
  },
  {
    href: "/deals/proposal",
    view: "proposal",
    label: "КП",
    description: "Пропозиція клієнту",
  },
  {
    href: "/deals/negotiation",
    view: "negotiation",
    label: "Договір",
    description: "Переговори та підписання",
  },
  {
    href: "/deals/won",
    view: "won",
    label: "Успішні",
    description: "Закриті з виграшем",
  },
  {
    href: "/deals/lost",
    view: "lost",
    label: "Втрачені",
    description: "Закриті з втратою",
  },
  {
    href: "/deals/archived",
    view: "archived",
    label: "Архів",
    description: "На утриманні",
  },
];

export function dealListHrefForView(view: DealListViewId): string {
  const r = DEAL_LIST_ROUTES.find((x) => x.view === view);
  return r?.href ?? "/deals";
}
