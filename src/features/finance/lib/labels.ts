/**
 * Українські підписи для фінансового UI (операційні статуси та типи в БД лишаються англ.).
 */

import type { FinanceAccount } from "../types/models";

export const FINANCE_TRANSACTION_TYPE_UA: Record<string, string> = {
  INCOME: "Надходження",
  EXPENSE: "Витрата",
  PAYROLL: "Зарплата / винагорода",
  COMMISSION: "Комісія",
  TRANSFER: "Переказ",
  REFUND: "Повернення",
};

export function financeTransactionTypeUa(type: string): string {
  return FINANCE_TRANSACTION_TYPE_UA[type] ?? type;
}

export const COUNTERPARTY_TYPE_UA: Record<string, string> = {
  CLIENT: "Клієнт",
  SUPPLIER: "Постачальник",
  EMPLOYEE: "Співробітник",
  PARTNER: "Партнер",
  CONTRACTOR: "Підрядник",
};

export function counterpartyTypeUa(t: string): string {
  return COUNTERPARTY_TYPE_UA[t] ?? t;
}

export const PAYMENT_PLAN_STATUS_UA: Record<string, string> = {
  PLANNED: "Заплановано",
  PARTIALLY_PAID: "Частково оплачено",
  PAID: "Оплачено",
  OVERDUE: "Прострочено",
  CANCELLED: "Скасовано",
};

export function paymentPlanStatusUa(status: string): string {
  return PAYMENT_PLAN_STATUS_UA[status] ?? status;
}

export const FINANCE_TX_STATUS_UA: Record<string, string> = {
  DRAFT: "Чернетка",
  CONFIRMED: "Проведено",
  CANCELLED: "Скасовано",
};

export function financeTransactionStatusUa(status: string): string {
  return FINANCE_TX_STATUS_UA[status] ?? status;
}

/** Тип рахунку (каса / банк / картка) — для підписів у реєстрі. */
export const FINANCE_ACCOUNT_TYPE_UA: Record<string, string> = {
  CASH: "Каса",
  BANK: "Банк",
  CARD: "Картка",
};

export function financeAccountTypeUa(type: string): string {
  return FINANCE_ACCOUNT_TYPE_UA[type] ?? type;
}

/** Назва + тип рахунку для колонки «Рахунок». */
export function buildAccountLabelById(accounts: FinanceAccount[]): Record<string, string> {
  return Object.fromEntries(
    accounts.map((a) => [
      a.id,
      `${a.name} · ${financeAccountTypeUa(a.type)}${a.currency && a.currency !== "UAH" ? ` · ${a.currency}` : ""}`,
    ]),
  );
}
