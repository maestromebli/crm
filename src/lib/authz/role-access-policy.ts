/**
 * Політика прав доступу за ролями (ENVER CRM).
 *
 * **Адміністратор (`SUPER_ADMIN`)** — повний доступ до всіх `PermissionKey` у БД;
 * перевірки `hasEffectivePermission` для нього зазвичай обходяться (окрім імпersonації).
 *
 * **Директор (`DIRECTOR`)** — ті самі права в БД, що й адміністратор, але без обходу перевірок
 * у JWT: усі дії мають бути представлені записами `PermissionOnUser` (через `grantAllPermissions`).
 *
 * **Адміністратор операційний (`ADMIN`)** — видимість даних як у директора (`normalizeRole` → DIRECTOR),
 * права: усі модулі крім **глобального керування ролями** (`ROLES_MANAGE`), щоб не змінювати
 * матрицю системних ролей; решта — підтримка користувачів, налаштувань, замовлень, виробництва.
 *
 * **Головний менеджер (`HEAD_MANAGER`)** — лінія продажів + команда в `data-scope`; без керування
 * обліковими записами, ролями, аудиту та адмін-панелі (див. `HEAD_MANAGER_EXCLUDED_KEYS`).
 *
 * **Менеджер з продажів (`SALES_MANAGER`)** — власні ліди/замовлення/задачі в межах scope; повний
 * операційний контур продажу без фінансової аналітики собівартості/маржі, без налаштувань і HR.
 *
 * Legacy: `MANAGER` → та сама політика, що `HEAD_MANAGER`; `USER` → як `SALES_MANAGER`.
 */

import type { PermissionKey, Role } from "@prisma/client";

/** Повний перелік ключів (узгоджено з `enum PermissionKey` у prisma/schema.prisma). */
export const ALL_PERMISSION_KEYS: readonly PermissionKey[] = [
  "DASHBOARD_VIEW",
  "LEADS_VIEW",
  "CONTACTS_VIEW",
  "CALENDAR_VIEW",
  "TASKS_VIEW",
  "ORDERS_VIEW",
  "PRODUCTS_VIEW",
  "REPORTS_VIEW",
  "REPORTS_EXPORT",
  "NOTIFICATIONS_VIEW",
  "ADMIN_PANEL_VIEW",
  "SETTINGS_VIEW",
  "LEADS_CREATE",
  "LEADS_UPDATE",
  "LEADS_ASSIGN",
  "DEALS_VIEW",
  "DEALS_CREATE",
  "DEALS_UPDATE",
  "DEALS_ASSIGN",
  "DEALS_STAGE_CHANGE",
  "TASKS_CREATE",
  "TASKS_UPDATE",
  "TASKS_ASSIGN",
  "FILES_VIEW",
  "FILES_UPLOAD",
  "FILES_DELETE",
  "ESTIMATES_VIEW",
  "ESTIMATES_CREATE",
  "ESTIMATES_UPDATE",
  "QUOTES_CREATE",
  "CONTRACTS_VIEW",
  "CONTRACTS_CREATE",
  "CONTRACTS_UPDATE",
  "PAYMENTS_VIEW",
  "PAYMENTS_UPDATE",
  "COST_VIEW",
  "MARGIN_VIEW",
  "SETTINGS_MANAGE",
  "USERS_VIEW",
  "USERS_MANAGE",
  "ROLES_MANAGE",
  "AUDIT_LOG_VIEW",
  "DEAL_WORKSPACE_VIEW",
  "CONTRACT_VIEW",
  "CONTRACT_EDIT",
  "CONTRACT_APPROVE_INTERNAL",
  "CONTRACT_SEND_SIGNATURE",
  "FILE_UPLOAD",
  "FILE_DELETE",
  "READINESS_OVERRIDE_REQUEST",
  "READINESS_OVERRIDE_APPROVE",
  "HANDOFF_SUBMIT",
  "HANDOFF_ACCEPT",
  "PRODUCTION_LAUNCH",
  "PRODUCTION_ORDERS_VIEW",
  "PRODUCTION_ORDERS_MANAGE",
  "PRODUCTION_ORCHESTRATION_VIEW",
  "PRODUCTION_ORCHESTRATION_MANAGE",
  "PAYMENT_CONFIRM",
  "AI_USE",
  "AI_ANALYTICS",
] as const;

/** Головний менеджер: без керування користувачами/ролями та глобального аудиту. */
export const HEAD_MANAGER_EXCLUDED_KEYS: readonly PermissionKey[] = [
  "USERS_MANAGE",
  "ROLES_MANAGE",
  "AUDIT_LOG_VIEW",
  "ADMIN_PANEL_VIEW",
];

/** Операційний адмін: без зміни системної матриці ролей. */
export const OPERATIONAL_ADMIN_EXCLUDED_KEYS: readonly PermissionKey[] = [
  "ROLES_MANAGE",
];

/**
 * Менеджер продажів: повний цикл замовлення в межах своїх даних, без margin/cost, без settings/users.
 */
export const SALES_MANAGER_PERMISSION_KEYS: readonly PermissionKey[] = [
  "DASHBOARD_VIEW",
  "LEADS_VIEW",
  "LEADS_CREATE",
  "LEADS_UPDATE",
  "LEADS_ASSIGN",
  "CONTACTS_VIEW",
  "CALENDAR_VIEW",
  "TASKS_VIEW",
  "TASKS_CREATE",
  "TASKS_UPDATE",
  "TASKS_ASSIGN",
  "DEALS_VIEW",
  "DEALS_CREATE",
  "DEALS_UPDATE",
  "DEALS_ASSIGN",
  "DEALS_STAGE_CHANGE",
  "DEAL_WORKSPACE_VIEW",
  "NOTIFICATIONS_VIEW",
  "FILES_VIEW",
  "FILES_UPLOAD",
  "FILES_DELETE",
  "FILE_UPLOAD",
  "FILE_DELETE",
  "ESTIMATES_VIEW",
  "ESTIMATES_CREATE",
  "ESTIMATES_UPDATE",
  "QUOTES_CREATE",
  "CONTRACTS_VIEW",
  "CONTRACTS_CREATE",
  "CONTRACTS_UPDATE",
  "CONTRACT_VIEW",
  "CONTRACT_EDIT",
  "CONTRACT_SEND_SIGNATURE",
  "PAYMENTS_VIEW",
  "PAYMENTS_UPDATE",
  "PAYMENT_CONFIRM",
  "HANDOFF_SUBMIT",
  "READINESS_OVERRIDE_REQUEST",
  "PRODUCTION_LAUNCH",
  "REPORTS_VIEW",
  "ORDERS_VIEW",
  "PRODUCTS_VIEW",
  "AI_USE",
];

/** Замірник: календар + обмежені ліди; без замовлень/фінансів/редагування комерції. */
export const MEASURER_PERMISSION_KEYS: readonly PermissionKey[] = [
  "DASHBOARD_VIEW",
  "LEADS_VIEW",
  "CALENDAR_VIEW",
  "TASKS_VIEW",
  "NOTIFICATIONS_VIEW",
  "AI_USE",
];

export const PRODUCTION_WORKER_PERMISSION_KEYS: readonly PermissionKey[] = [
  "DASHBOARD_VIEW",
  "DEALS_VIEW",
  "DEAL_WORKSPACE_VIEW",
  "FILES_VIEW",
  "FILES_UPLOAD",
  "TASKS_VIEW",
  "TASKS_UPDATE",
  "PRODUCTION_ORDERS_VIEW",
  "PRODUCTION_ORCHESTRATION_VIEW",
  "NOTIFICATIONS_VIEW",
  "AI_USE",
];

const WORKSHOP_BASE_PERMISSION_KEYS: readonly PermissionKey[] = [
  "DASHBOARD_VIEW",
  "DEALS_VIEW",
  "DEAL_WORKSPACE_VIEW",
  "TASKS_VIEW",
  "TASKS_UPDATE",
  "PRODUCTION_ORDERS_VIEW",
  "NOTIFICATIONS_VIEW",
  "AI_USE",
];

export const CUTTING_PERMISSION_KEYS: readonly PermissionKey[] = [
  ...WORKSHOP_BASE_PERMISSION_KEYS,
  "FILES_VIEW",
];

export const EDGING_PERMISSION_KEYS: readonly PermissionKey[] = [
  ...WORKSHOP_BASE_PERMISSION_KEYS,
  "FILES_VIEW",
];

export const DRILLING_PERMISSION_KEYS: readonly PermissionKey[] = [
  ...WORKSHOP_BASE_PERMISSION_KEYS,
  "FILES_VIEW",
];

export const ASSEMBLY_PERMISSION_KEYS: readonly PermissionKey[] = [
  ...WORKSHOP_BASE_PERMISSION_KEYS,
  "FILES_VIEW",
  "FILES_UPLOAD",
  "HANDOFF_ACCEPT",
];

export const CONSTRUCTOR_PERMISSION_KEYS: readonly PermissionKey[] = [
  "DASHBOARD_VIEW",
  "DEALS_VIEW",
  "DEAL_WORKSPACE_VIEW",
  "FILES_VIEW",
  "FILES_UPLOAD",
  "FILES_DELETE",
  "FILE_UPLOAD",
  "FILE_DELETE",
  "TASKS_VIEW",
  "TASKS_UPDATE",
  "PRODUCTION_ORDERS_VIEW",
  "PRODUCTION_ORCHESTRATION_VIEW",
  "PRODUCTION_ORCHESTRATION_MANAGE",
  "NOTIFICATIONS_VIEW",
  "AI_USE",
];

const headExcludedSet = new Set(HEAD_MANAGER_EXCLUDED_KEYS);
const adminExcludedSet = new Set(OPERATIONAL_ADMIN_EXCLUDED_KEYS);

export type DefaultPermissionMode = "ALL" | PermissionKey[];

export function getDefaultPermissionKeysForRole(role: Role): DefaultPermissionMode {
  switch (role as string) {
    case "SUPER_ADMIN":
    case "DIRECTOR":
    case "DIRECTOR_PRODUCTION":
      return "ALL";
    case "HEAD_MANAGER":
    case "MANAGER":
      return ALL_PERMISSION_KEYS.filter((k) => !headExcludedSet.has(k));
    case "TEAM_LEAD":
      return ALL_PERMISSION_KEYS.filter((k) => !headExcludedSet.has(k));
    case "ADMIN":
      return ALL_PERMISSION_KEYS.filter((k) => !adminExcludedSet.has(k));
    case "SALES_MANAGER":
    case "USER":
      return [...SALES_MANAGER_PERMISSION_KEYS];
    case "MEASURER":
      return [...MEASURER_PERMISSION_KEYS];
    case "PRODUCTION_WORKER":
      return [...PRODUCTION_WORKER_PERMISSION_KEYS];
    case "CUTTING":
      return [...CUTTING_PERMISSION_KEYS];
    case "EDGING":
      return [...EDGING_PERMISSION_KEYS];
    case "DRILLING":
      return [...DRILLING_PERMISSION_KEYS];
    case "ASSEMBLY":
      return [...ASSEMBLY_PERMISSION_KEYS];
    case "CONSTRUCTOR":
      return [...CONSTRUCTOR_PERMISSION_KEYS];
    case "ACCOUNTANT":
      return [
        ...ALL_PERMISSION_KEYS.filter(
          (k) =>
            !headExcludedSet.has(k) &&
            k !== "LEADS_ASSIGN" &&
            k !== "DEALS_ASSIGN",
        ),
        "AI_USE",
      ];
    case "PROCUREMENT_MANAGER":
      return [
        ...ALL_PERMISSION_KEYS.filter(
          (k) =>
            !headExcludedSet.has(k) &&
            k !== "ROLES_MANAGE" &&
            k !== "USERS_MANAGE",
        ),
        "AI_USE",
        "AI_ANALYTICS",
      ];
    default:
      return [...SALES_MANAGER_PERMISSION_KEYS];
  }
}

/** Короткі описи для UI (налаштування користувачів, довідка). */
export const ROLE_POLICY_SUMMARY_UK: Record<string, string> = {
  SUPER_ADMIN:
    "Повний доступ до системи та всіх прав; обхід перевірок прав у сесії (окрім імпersonації).",
  DIRECTOR:
    "Усі права в БД як у адміністратора, звичайні перевірки JWT; зазвичай — керівник компанії.",
  DIRECTOR_PRODUCTION:
    "Керівник виробництва: повний доступ до модулів якості, планування, цеху та інтеграцій.",
  ADMIN:
    "Допомога команді: користувачі, налаштування, замовлення, виробництво; без зміни ROLES_MANAGE.",
  HEAD_MANAGER:
    "Команда продажів у data-scope; без USERS_MANAGE, ROLES_MANAGE, аудиту, адмін-панелі.",
  MANAGER: "Legacy-роль: політика як у головного менеджера.",
  SALES_MANAGER:
    "Продажі та воркспейс замовлення; без собівартості/маржі, без налаштувань і керування ролями.",
  USER: "Legacy-роль: політика як у менеджера з продажів.",
  MEASURER:
    "Замірник: лише призначені заміри та обмежений перегляд лідів; без фінансів та комерційного редагування.",
  ACCOUNTANT: "Бухгалтерія: фінансові модулі та звітність; обмеження на операції продажів за політикою.",
  PROCUREMENT_MANAGER:
    "Закупівлі / виробництво: розширений доступ до замовлень і постачання без керування ролями.",
  PRODUCTION_WORKER:
    "Працівник виробництва: перегляд задач/файлів і робота з призначеними виробничими операціями.",
  CUTTING:
    "Дільниця порізки: перегляд креслень/файлів і виконання своїх задач без оркестрації та передачі.",
  EDGING:
    "Дільниця крайкування: перегляд файлів і виконання своїх задач без оркестрації та передачі.",
  DRILLING:
    "Дільниця присадки: перегляд файлів і виконання своїх задач без оркестрації та передачі.",
  ASSEMBLY:
    "Дільниця збірки: задачі + завантаження фото/файлів по виконанню та підтвердження приймання handoff.",
  CONSTRUCTOR:
    "Конструктор: робота з техдоками/файлами та оркестрацією виробництва (перегляд і керування в межах конструкторського потоку).",
};

/** Короткий ярлик профілю доступу для UI в налаштуваннях користувачів. */
export const ROLE_ACCESS_PROFILE_UK: Partial<Record<Role, string>> = {
  CUTTING: "Цеховий профіль: Порізка",
  EDGING: "Цеховий профіль: Крайкування",
  DRILLING: "Цеховий профіль: Присадка",
  ASSEMBLY: "Цеховий профіль: Збірка",
  CONSTRUCTOR: "Конструкторський профіль",
  PRODUCTION_WORKER: "Цеховий профіль: Універсальний",
};
