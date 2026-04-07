export type SettingsAccess = "admin" | "super-admin";

export type SettingsItem = {
  id: string;
  section: string;
  label: string;
  access: SettingsAccess;
  path: string;
};

export const SETTINGS_ITEMS: SettingsItem[] = [
  {
    id: "general",
    section: "Загальне",
    label: "Загальні налаштування",
    access: "admin",
    path: "/settings",
  },
  {
    id: "users",
    section: "Користувачі та ролі",
    label: "Користувачі та ролі",
    access: "super-admin",
    path: "/settings/users",
  },
  {
    id: "permissions",
    section: "Доступ",
    label: "Права доступу",
    access: "super-admin",
    path: "/settings/permissions",
  },
  {
    id: "access-hierarchy",
    section: "Доступ",
    label: "Ієрархія менеджерів",
    access: "super-admin",
    path: "/settings/access-hierarchy",
  },
  {
    id: "pipelines",
    section: "Воронки",
    label: "Воронки та стадії",
    access: "admin",
    path: "/settings/pipelines",
  },
  {
    id: "custom-fields",
    section: "Кастомізація",
    label: "Кастомні поля",
    access: "admin",
    path: "/settings/custom-fields",
  },
  {
    id: "file-categories",
    section: "Файли",
    label: "Категорії файлів",
    access: "admin",
    path: "/settings/file-categories",
  },
  {
    id: "checklists",
    section: "Чек-листи",
    label: "Шаблони чек-листів",
    access: "admin",
    path: "/settings/checklists",
  },
  {
    id: "notifications",
    section: "Сповіщення",
    label: "Правила сповіщень",
    access: "admin",
    path: "/settings/notifications",
  },
  {
    id: "calendar",
    section: "Календар",
    label: "Календар і слоти",
    access: "admin",
    path: "/settings/calendar",
  },
  {
    id: "inbox",
    section: "Вхідні / Telegram",
    label: "Вхідні / Telegram",
    access: "admin",
    path: "/settings/inbox",
  },
  {
    id: "communications",
    section: "Канали звʼязку",
    label: "Месенджери та телефонія",
    access: "admin",
    path: "/settings/communications",
  },
  {
    id: "my-communications",
    section: "Канали звʼязку",
    label: "Мої підключення",
    access: "admin",
    path: "/settings/communications/me",
  },
  {
    id: "users-communications",
    section: "Канали звʼязку",
    label: "Підключення співробітників",
    access: "super-admin",
    path: "/settings/communications/users",
  },
  {
    id: "communications-health",
    section: "Канали звʼязку",
    label: "Health каналів",
    access: "admin",
    path: "/settings/communications/health",
  },
  {
    id: "ai",
    section: "ШІ",
    label: "AI‑налаштування",
    access: "admin",
    path: "/settings/ai",
  },
  {
    id: "branding",
    section: "Брендинг",
    label: "Брендинг / UI",
    access: "admin",
    path: "/settings/branding",
  },
  {
    id: "integrations",
    section: "Інтеграції",
    label: "Інтеграції",
    access: "super-admin",
    path: "/settings/integrations",
  },
  {
    id: "meta-target",
    section: "Інтеграції",
    label: "Instagram / Meta таргет",
    access: "admin",
    path: "/settings/integrations/meta-target",
  },
];

