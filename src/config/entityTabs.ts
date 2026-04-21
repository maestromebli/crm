export type EntityKind = "lead" | "contact" | "deal" | "handoff" | "conversation";

export type EntityTab = {
  id: string;
  label: string;
  href: (id: string) => string;
  /** Виділена кнопка (наприклад AI) */
  style?: "default" | "accentPill";
};

export type EntityTabsConfig = Record<EntityKind, EntityTab[]>;

export const ENTITY_TABS: EntityTabsConfig = {
  lead: [
    { id: "overview", label: "Хаб ліда", href: (id) => `/leads/${id}` },
    { id: "messages", label: "Діалог", href: (id) => `/leads/${id}/messages` },
    { id: "contact", label: "Контакт", href: (id) => `/leads/${id}/contact` },
    {
      id: "pricing",
      label: "Розрахунок / КП",
      href: (id) => `/leads/${id}/pricing`,
    },
    { id: "tasks", label: "Задачі", href: (id) => `/leads/${id}/tasks` },
    { id: "files", label: "Файли", href: (id) => `/leads/${id}/files` },
    { id: "activity", label: "Історія", href: (id) => `/leads/${id}/activity` },
    {
      id: "ai",
      label: "AI",
      href: (id) => `/leads/${id}/ai`,
      style: "accentPill",
    },
  ],
  contact: [
    { id: "overview", label: "Огляд", href: (id) => `/contacts/${id}` },
    { id: "deals", label: "Замовлення", href: (id) => `/contacts/${id}/deals` },
    { id: "conversations", label: "Діалоги", href: (id) => `/contacts/${id}/conversations` },
    { id: "files", label: "Файли", href: (id) => `/contacts/${id}/files` },
    { id: "tasks", label: "Задачі", href: (id) => `/contacts/${id}/tasks` },
    { id: "activity", label: "Активність", href: (id) => `/contacts/${id}/activity` },
  ],
  /** Усі пункти ведуть у єдине робоче місце; `tab` відкриває відповідну панель. */
  deal: [
    {
      id: "workspace",
      label: "Робоче місце",
      href: (id) => `/deals/${id}/workspace`,
    },
    {
      id: "contacts",
      label: "Контакти",
      href: (id) => `/deals/${id}/workspace?tab=messages`,
    },
    {
      id: "calendar",
      label: "Календар",
      href: (id) => `/deals/${id}/workspace?tab=measurement`,
    },
    { id: "tasks", label: "Задачі", href: (id) => `/deals/${id}/workspace?tab=tasks` },
    { id: "files", label: "Файли", href: (id) => `/deals/${id}/workspace?tab=files` },
    {
      id: "handoff",
      label: "Передача",
      href: (id) => `/deals/${id}/workspace?tab=handoff`,
    },
    {
      id: "activity",
      label: "Активність",
      href: (id) => `/deals/${id}/workspace?tab=activity`,
    },
  ],
  handoff: [
    { id: "overview", label: "Огляд", href: (id) => `/handoff/${id}` },
    { id: "checklist", label: "Чек‑лист", href: (id) => `/handoff/${id}/checklist` },
    { id: "files", label: "Файли", href: (id) => `/handoff/${id}/files` },
    { id: "comments", label: "Коментарі", href: (id) => `/handoff/${id}/comments` },
    { id: "history", label: "Історія прийняття", href: (id) => `/handoff/${id}/history` },
  ],
  conversation: [
    { id: "thread", label: "Діалог", href: (id) => `/inbox/${id}` },
    { id: "crm", label: "CRM‑звʼязки", href: (id) => `/inbox/${id}/crm` },
    { id: "tasks", label: "Задачі", href: (id) => `/inbox/${id}/tasks` },
    { id: "files", label: "Файли", href: (id) => `/inbox/${id}/files` },
    { id: "activity", label: "Активність", href: (id) => `/inbox/${id}/activity` },
    { id: "ai", label: "ШІ-огляд", href: (id) => `/inbox/${id}/ai` },
  ],
};

