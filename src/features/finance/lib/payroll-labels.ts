/** Людськочитані підписи для ролей і статусів у зарплатному модулі. */

const ROLE_UA: Record<string, string> = {
  Замір: "Замір",
  Установка: "Установка / монтаж",
  Збірка: "Збірка",
  Конструктор: "Конструктор",
  INSTALL: "Монтаж",
  ASSEMBLY: "Збірка",
  CONSTRUCTOR: "Конструктор",
  MANAGER: "Менеджер",
  SALES: "Продажі",
};

const STATUS_UA: Record<string, string> = {
  DRAFT: "Чернетка",
  APPROVED: "Погоджено",
  PAID: "Виплачено",
  CANCELLED: "Скасовано",
  PENDING: "Очікує",
};

export function formatPayrollRoleUa(roleType: string): string {
  const t = roleType.trim();
  if (ROLE_UA[t]) return ROLE_UA[t];
  const u = t.toUpperCase();
  if (ROLE_UA[u]) return ROLE_UA[u];
  return t;
}

export function formatPayrollStatusUa(status: string): string {
  return STATUS_UA[status] ?? status;
}

const CALC_UA: Record<string, string> = {
  FIXED: "Фіксована сума",
  PERCENT: "Відсоток",
};

export function formatPayrollCalcUa(calcType: string): string {
  return CALC_UA[calcType] ?? calcType;
}
