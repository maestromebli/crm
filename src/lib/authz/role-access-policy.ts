/**
 * Політика прав доступу за ролями (ENVER CRM).
 *
 * Контракт ролей/прав винесено в `config/rbac-role-policy.json`, щоб
 * runtime та скрипти синхронно використовували одну матрицю.
 */

import type { PermissionKey, Role } from "@prisma/client";
import {
  getContractPermissionModeForRole,
  RBAC_ALL_PERMISSION_KEYS,
  RBAC_NAMED_PERMISSION_SETS,
  type DefaultPermissionMode,
} from "./rbac-contract";

/** Повний перелік ключів (узгоджено з `enum PermissionKey` у prisma/schema.prisma). */
export const ALL_PERMISSION_KEYS: readonly PermissionKey[] = RBAC_ALL_PERMISSION_KEYS;

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

export const SALES_MANAGER_PERMISSION_KEYS: readonly PermissionKey[] = [
  ...(RBAC_NAMED_PERMISSION_SETS.SALES_MANAGER_CORE ?? []),
];

export const MEASURER_PERMISSION_KEYS: readonly PermissionKey[] = [
  ...(RBAC_NAMED_PERMISSION_SETS.MEASURER_CORE ?? []),
];

export const PRODUCTION_WORKER_PERMISSION_KEYS: readonly PermissionKey[] = [
  ...(RBAC_NAMED_PERMISSION_SETS.PRODUCTION_WORKER_CORE ?? []),
];

const WORKSHOP_BASE_PERMISSION_KEYS: readonly PermissionKey[] = [
  ...(RBAC_NAMED_PERMISSION_SETS.WORKSHOP_BASE_CORE ?? []),
];

export const CUTTING_PERMISSION_KEYS: readonly PermissionKey[] = [
  ...(RBAC_NAMED_PERMISSION_SETS.CUTTING_CORE ?? WORKSHOP_BASE_PERMISSION_KEYS),
];

export const EDGING_PERMISSION_KEYS: readonly PermissionKey[] = [
  ...(RBAC_NAMED_PERMISSION_SETS.EDGING_CORE ?? WORKSHOP_BASE_PERMISSION_KEYS),
];

export const DRILLING_PERMISSION_KEYS: readonly PermissionKey[] = [
  ...(RBAC_NAMED_PERMISSION_SETS.DRILLING_CORE ?? WORKSHOP_BASE_PERMISSION_KEYS),
];

export const ASSEMBLY_PERMISSION_KEYS: readonly PermissionKey[] = [
  ...(RBAC_NAMED_PERMISSION_SETS.ASSEMBLY_CORE ?? WORKSHOP_BASE_PERMISSION_KEYS),
];

export const CONSTRUCTOR_PERMISSION_KEYS: readonly PermissionKey[] = [
  ...(RBAC_NAMED_PERMISSION_SETS.CONSTRUCTOR_CORE ?? []),
];

export function getDefaultPermissionKeysForRole(role: Role): DefaultPermissionMode {
  return getContractPermissionModeForRole(role);
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
