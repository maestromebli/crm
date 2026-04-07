/**
 * Єдине джерело правди для бокового меню та вкладки «Доступ» у профілі користувача
 * (`/settings/users/[id]`). Нові `NavSection` / `subItems` автоматично зʼявляються в UI
 * налаштувань (через `buildNavManifest()`).
 */
import type React from "react";
import {
  LayoutDashboard,
  Users,
  KanbanSquare,
  Calendar,
  Mail,
  Wallet,
  ShoppingCart,
  Warehouse,
  Factory,
  Shuffle,
  CheckSquare,
  FolderOpen,
  BarChart3,
  Settings,
} from "lucide-react";
import { P, type Phase1Permission } from "../lib/authz/permissions";

export type NavPermissionKey = Phase1Permission;

export type NavSubItem = {
  id: string;
  label: string;
  href: string;
  description?: string;
};

export type NavSection = {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  /** Канонічний ключ Prisma / `P.*` */
  permission?: NavPermissionKey;
  subItems?: NavSubItem[];
};

export const NAV_SECTIONS: NavSection[] = [
  {
    id: "dashboard",
    label: "Дашборд",
    icon: LayoutDashboard,
    href: "/crm/dashboard",
    permission: P.DASHBOARD_VIEW,
    subItems: [
      {
        id: "overview",
        label: "Огляд",
        href: "/crm/dashboard",
        description: "Головний операційний огляд.",
      },
    ],
  },
  {
    id: "leads",
    label: "Ліди",
    icon: Users,
    href: "/leads",
    permission: P.LEADS_VIEW,
    subItems: [
      { id: "all", label: "Усі ліди", href: "/leads" },
      { id: "new", label: "Нові", href: "/leads/new" },
      {
        id: "no-response",
        label: "Без відповіді (SLA)",
        href: "/leads/no-response",
        description: "Новий лід без першого дотику менеджера після дедлайну.",
      },
      {
        id: "no-next-step",
        label: "Без наступного кроку",
        href: "/leads/no-next-step",
      },
      { id: "mine", label: "Мої", href: "/leads/mine" },
      {
        id: "overdue",
        label: "Прострочені контакти",
        href: "/leads/overdue",
      },
      {
        id: "duplicates",
        label: "Дублі телефону",
        href: "/leads/duplicates",
      },
      {
        id: "re-contact",
        label: "Перезвʼязок сьогодні",
        href: "/leads/re-contact",
        description: "Запланований контакт до кінця дня або прострочений.",
      },
      {
        id: "converted",
        label: "Конвертовані",
        href: "/leads/converted",
        description: "Ліди з привʼязаною угодою.",
      },
      {
        id: "unassigned",
        label: "На розподіл",
        href: "/leads/unassigned",
        description: "Нові ліди, з якими ще не працювали.",
      },
      { id: "qualified", label: "Кваліфіковані", href: "/leads/qualified" },
      { id: "lost", label: "Закриті / архів", href: "/leads/lost" },
      { id: "sources", label: "Джерела", href: "/leads/sources" },
      { id: "pipeline", label: "Воронка лідів", href: "/leads/pipeline" },
    ],
  },
  {
    id: "contacts",
    label: "Контакти",
    icon: Users,
    href: "/contacts",
    permission: P.CONTACTS_VIEW,
    subItems: [
      { id: "all", label: "Усі контакти", href: "/contacts" },
      { id: "clients", label: "Клієнти", href: "/contacts/clients" },
      { id: "partners", label: "Дизайнери / партнери", href: "/contacts/partners" },
      { id: "repeat", label: "Повторні клієнти", href: "/contacts/repeat" },
      { id: "segments", label: "Сегменти", href: "/contacts/segments" },
      { id: "activity", label: "Активність", href: "/contacts/activity" },
    ],
  },
  {
    id: "deals",
    label: "Угоди",
    icon: KanbanSquare,
    href: "/deals",
    permission: P.DEALS_VIEW,
    subItems: [
      {
        id: "all",
        label: "Усі угоди",
        href: "/deals",
        description:
          "Список угод; кнопка «Робоче місце» — єдине вікно від КП до виробництва.",
      },
      { id: "pipeline", label: "Дошка воронки", href: "/deals/pipeline" },
      { id: "active", label: "Активні проєкти", href: "/deals/active" },
      { id: "waiting-measure", label: "Очікують заміру", href: "/deals/waiting-measure" },
      { id: "proposal", label: "КП надіслано", href: "/deals/proposal" },
      { id: "negotiation", label: "Переговори", href: "/deals/negotiation" },
      { id: "won", label: "Успішні", href: "/deals/won" },
      { id: "lost", label: "Втрачені", href: "/deals/lost" },
      { id: "archived", label: "Архів", href: "/deals/archived" },
    ],
  },
  {
    id: "calendar",
    label: "Календар",
    icon: Calendar,
    href: "/calendar",
    permission: P.CALENDAR_VIEW,
    subItems: [
      { id: "my", label: "Мій календар", href: "/calendar" },
      { id: "team", label: "Календар команди", href: "/calendar/team" },
      { id: "measurements", label: "Заміри", href: "/calendar/measurements" },
      { id: "meetings", label: "Зустрічі", href: "/calendar/meetings" },
      { id: "installations", label: "Монтажі", href: "/calendar/installations" },
      { id: "production", label: "Виробництво", href: "/calendar/production" },
      { id: "agenda", label: "Порядок дня", href: "/calendar/agenda" },
    ],
  },
  {
    id: "inbox",
    label: "Вхідні",
    icon: Mail,
    href: "/inbox",
    permission: P.NOTIFICATIONS_VIEW,
    subItems: [
      { id: "all", label: "Усі діалоги", href: "/inbox" },
      { id: "unread", label: "Непрочитані", href: "/inbox/unread" },
      { id: "unanswered", label: "Без відповіді", href: "/inbox/unanswered" },
      { id: "overdue", label: "Прострочені", href: "/inbox/overdue" },
      { id: "mine", label: "Призначені мені", href: "/inbox/mine" },
      { id: "unlinked", label: "Без CRM‑звʼязку", href: "/inbox/unlinked" },
      { id: "telegram", label: "Telegram", href: "/inbox/telegram" },
    ],
  },
  {
    id: "finance",
    label: "Фінанси",
    icon: Wallet,
    href: "/crm/finance",
    permission: P.PAYMENTS_VIEW,
    subItems: [
      {
        id: "overview",
        label: "Огляд",
        href: "/crm/finance",
        description: "KPI, транзакції та план оплат.",
      },
      {
        id: "journal",
        label: "Журнал проводок",
        href: "/crm/finance/journal",
        description: "План рахунків і подвійний запис.",
      },
      {
        id: "registry",
        label: "Реєстр",
        href: "/crm/finance/registry",
      },
      {
        id: "payroll",
        label: "Зарплата",
        href: "/crm/finance/payroll",
      },
      {
        id: "banking",
        label: "Банки",
        href: "/crm/finance/banking",
      },
      {
        id: "warehouse-fin",
        label: "Склад (запаси)",
        href: "/warehouse",
        description: "Оцінка залишків і резерви в контури фінансів.",
      },
    ],
  },
  {
    id: "procurement",
    label: "Закупівлі",
    icon: ShoppingCart,
    href: "/crm/procurement",
    permission: P.COST_VIEW,
    subItems: [
      {
        id: "overview",
        label: "Огляд",
        href: "/crm/procurement",
        description: "Заявки, позиції та контроль закупівель.",
      },
      {
        id: "procurement-hub",
        label: "Операційний hub",
        href: "/crm/procurement?view=hub",
        description: "Kanban PO, склад, radar постачальників, форми ERP.",
      },
      {
        id: "warehouse-wms",
        label: "Склад WMS",
        href: "/warehouse",
        description: "Залишки, резерви, рух — звʼязок з PO та виробництвом.",
      },
    ],
  },
  {
    id: "warehouse",
    label: "Склад",
    icon: Warehouse,
    href: "/warehouse",
    permission: P.COST_VIEW,
    subItems: [
      {
        id: "overview",
        label: "Огляд",
        href: "/warehouse",
        description: "WMS: залишки, оцінка запасів, звʼязки з PO та виробництвом.",
      },
      {
        id: "stock",
        label: "Залишки",
        href: "/warehouse/stock",
        description: "Таблиця номенклатури, резерв і доступність.",
      },
      {
        id: "movements",
        label: "Рух",
        href: "/warehouse/movements",
        description: "Надходження з закупівель та внутрішні переміщення.",
      },
      {
        id: "reservations",
        label: "Резерви",
        href: "/warehouse/reservations",
        description: "Матеріали зарезервовані під виробництво та угоди.",
      },
      {
        id: "zones",
        label: "Зони",
        href: "/warehouse/zones",
        description: "Стелажі, ряди — штрихкоди для сканерів ТСД.",
      },
    ],
  },
  {
    id: "production",
    label: "Виробництво",
    icon: Factory,
    href: "/crm/production",
    permission: P.PRODUCTION_LAUNCH,
    subItems: [
      { id: "queue", label: "Черга робіт", href: "/crm/production", description: "Штаб виробництва: KPI, черга, цех." },
      { id: "workshop", label: "Цеховий Kanban", href: "/crm/production/workshop" },
      {
        id: "mini-cutting",
        label: "Міні-штаб: порізка",
        href: "/crm/production/workshop/cutting",
        description: "Лише колонка порізки — для оператора розкрою.",
      },
      {
        id: "mini-edging",
        label: "Міні-штаб: поклейка",
        href: "/crm/production/workshop/edging",
        description: "Поклейка кромки / окантовка.",
      },
      {
        id: "mini-drilling",
        label: "Міні-штаб: присадка",
        href: "/crm/production/workshop/drilling",
        description: "Присадка під фурнітуру та кріплення.",
      },
      {
        id: "mini-assembly",
        label: "Міні-штаб: збірка",
        href: "/crm/production/workshop/assembly",
        description: "Збірка модулів на столі.",
      },
      {
        id: "legacy-line",
        label: "Угоди на лінії (класичний)",
        href: "/production/in-progress",
        description: "Таблиця активних угод у виробництві без штабу потоку.",
      },
      {
        id: "legacy-delays",
        label: "Затримки",
        href: "/production/delays",
        description: "Прострочення та відхилення від плану.",
      },
      {
        id: "legacy-ready-install",
        label: "Готові до монтажу",
        href: "/production/ready-install",
        description: "Замовлення, що чекають виїзду бригади.",
      },
      {
        id: "legacy-install-schedule",
        label: "Графік монтажу",
        href: "/production/installation-schedule",
        description: "План монтажів окремим екраном.",
      },
      {
        id: "procurement-from-production",
        label: "Закупівлі (хаб)",
        href: "/crm/procurement?view=hub",
        description: "Операційний контур: PO, склад, заявки.",
      },
      {
        id: "warehouse-wms",
        label: "Склад WMS",
        href: "/warehouse",
        description: "Залишки та резерви матеріалів під виробництво.",
      },
    ],
  },
  {
    id: "handoff",
    label: "Передача",
    icon: Shuffle,
    href: "/handoff",
    permission: P.HANDOFF_SUBMIT,
    subItems: [
      { id: "waiting", label: "Очікують передачі", href: "/handoff" },
      { id: "need-completion", label: "Потребують доповнення", href: "/handoff/need-completion" },
      { id: "ready", label: "Готові до прийняття", href: "/handoff/ready" },
      { id: "accepted", label: "Прийняті", href: "/handoff/accepted" },
      { id: "returned", label: "Повернуті на доопрацювання", href: "/handoff/returned" },
      { id: "checklists", label: "Чек-листи", href: "/handoff/checklists" },
    ],
  },
  {
    id: "tasks",
    label: "Задачі",
    icon: CheckSquare,
    href: "/tasks",
    permission: P.TASKS_VIEW,
    subItems: [
      {
        id: "day",
        label: "Мій день",
        href: "/today",
        description: "Прострочені та задачі на сьогодні — один екран.",
      },
      { id: "my", label: "Мої задачі", href: "/tasks" },
      { id: "team", label: "Задачі команди", href: "/tasks/team" },
      { id: "today", label: "Сьогодні (список)", href: "/tasks/today" },
      { id: "overdue", label: "Прострочені", href: "/tasks/overdue" },
      { id: "by-entity", label: "За сутністю", href: "/tasks/by-entity" },
      { id: "by-assignee", label: "За виконавцем", href: "/tasks/by-assignee" },
      { id: "completed", label: "Виконані", href: "/tasks/completed" },
    ],
  },
  {
    id: "files",
    label: "Файли",
    icon: FolderOpen,
    href: "/files",
    permission: P.FILES_VIEW,
    subItems: [
      { id: "all", label: "Усі файли", href: "/files" },
      { id: "by-deal", label: "За угодою", href: "/files/by-deal" },
      { id: "by-lead", label: "За лідами", href: "/files/by-lead" },
      { id: "by-handoff", label: "За передачею", href: "/files/by-handoff" },
      { id: "missing", label: "Відсутні обовʼязкові", href: "/files/missing" },
      { id: "recent", label: "Останні завантаження", href: "/files/recent" },
      { id: "templates", label: "Шаблони / документи", href: "/files/templates" },
    ],
  },
  {
    id: "reports",
    label: "Звіти",
    icon: BarChart3,
    href: "/reports",
    permission: P.REPORTS_VIEW,
    subItems: [
      { id: "sales", label: "Продажі", href: "/reports/sales" },
      { id: "conversion", label: "Конверсія лідів", href: "/reports/conversion" },
      { id: "team", label: "Команда", href: "/reports/team" },
      { id: "load", label: "Навантаження виробництва", href: "/reports/load" },
      { id: "installs", label: "Монтажі", href: "/reports/installations" },
      { id: "sla", label: "SLA відповіді", href: "/reports/sla" },
      { id: "files", label: "Заповненість файлів", href: "/reports/files" },
      { id: "custom", label: "Кастомні звіти", href: "/reports/custom" },
    ],
  },
  {
    id: "settings",
    label: "Налаштування",
    icon: Settings,
    href: "/settings",
    permission: P.SETTINGS_VIEW,
    subItems: [
      { id: "general", label: "Загальні", href: "/settings" },
      { id: "users", label: "Користувачі та ролі", href: "/settings/users" },
      { id: "permissions", label: "Права доступу", href: "/settings/permissions" },
      { id: "pipelines", label: "Воронки та стадії", href: "/settings/pipelines" },
      { id: "custom-fields", label: "Кастомні поля", href: "/settings/custom-fields" },
      { id: "file-categories", label: "Категорії файлів", href: "/settings/file-categories" },
      { id: "checklists", label: "Шаблони чек-листів", href: "/settings/checklists" },
      { id: "notifications", label: "Сповіщення", href: "/settings/notifications" },
      { id: "calendar", label: "Календар", href: "/settings/calendar" },
      { id: "inbox", label: "Вхідні / Telegram", href: "/settings/inbox" },
      { id: "ai", label: "AI‑налаштування", href: "/settings/ai" },
      { id: "branding", label: "Брендинг / UI", href: "/settings/branding" },
      { id: "integrations", label: "Інтеграції", href: "/settings/integrations" },
    ],
  },
];
