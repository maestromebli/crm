export type Uuid = string;

export type ProjectStatus =
  | "LEAD"
  | "APPROVED"
  | "IN_WORK"
  | "COMPLETED"
  | "CLOSED"
  | "CANCELLED";

export type FinanceTransactionType =
  | "INCOME"
  | "EXPENSE"
  | "PAYROLL"
  | "COMMISSION"
  | "TRANSFER"
  | "REFUND";

export type FinanceCategoryGroup = "INCOME" | "EXPENSE" | "PAYROLL" | "COMMISSION";

/**
 * Розріз операційних грошових витрат (не змішувати з планом закупівель).
 * Матеріали / логістика / послуги — окремо від зарплати та комісій.
 */
export type OperatingCashBucket =
  | "MATERIALS"
  | "SUBCONTRACTORS"
  | "MEASURING"
  | "CONSTRUCTOR"
  | "ASSEMBLY"
  | "INSTALLATION"
  | "LOGISTICS"
  | "PAYROLL"
  | "COMMISSIONS";

export const OPERATING_CASH_BUCKET_ORDER: OperatingCashBucket[] = [
  "MATERIALS",
  "SUBCONTRACTORS",
  "MEASURING",
  "CONSTRUCTOR",
  "ASSEMBLY",
  "INSTALLATION",
  "LOGISTICS",
  "PAYROLL",
  "COMMISSIONS",
];

export const OPERATING_CASH_BUCKET_UA: Record<OperatingCashBucket, string> = {
  MATERIALS: "Матеріали",
  SUBCONTRACTORS: "Підрядники",
  MEASURING: "Замір",
  CONSTRUCTOR: "Конструктор",
  ASSEMBLY: "Збірка",
  INSTALLATION: "Установка",
  LOGISTICS: "Логістика",
  PAYROLL: "Зарплата",
  COMMISSIONS: "Комісії",
};

export type CounterpartyType =
  | "CLIENT"
  | "SUPPLIER"
  | "EMPLOYEE"
  | "PARTNER"
  | "CONTRACTOR";

export type PaymentPlanStatus = "PLANNED" | "PARTIALLY_PAID" | "PAID" | "OVERDUE" | "CANCELLED";
export type FinanceTransactionStatus = "DRAFT" | "CONFIRMED" | "CANCELLED";

export type CrmRole =
  | "DIRECTOR"
  | "HEAD_MANAGER"
  | "SALES_MANAGER"
  | "ACCOUNTANT"
  | "PROCUREMENT_MANAGER";

/** @deprecated Використовуйте FinanceExecutiveKpi з aggregation.ts */
export type FinanceKpi = {
  revenue: number;
  received: number;
  clientDebt: number;
  expenses: number;
  grossProfit: number;
  netProfit: number;
};

export type FinanceCategory = {
  id: Uuid;
  name: string;
  group: FinanceCategoryGroup;
  color: string;
  sortOrder: number;
  isSystem: boolean;
  /** Для розкладки грошових витрат по статтях (транзакції, не закупівельні позиції). */
  operatingBucket?: OperatingCashBucket;
};

export type FinanceAccount = {
  id: Uuid;
  name: string;
  type: "CASH" | "BANK" | "CARD";
  currency: "UAH" | "USD" | "EUR";
  isActive: boolean;
};

export type FinanceTransaction = {
  id: Uuid;
  projectId: Uuid;
  objectId: Uuid | null;
  type: FinanceTransactionType;
  categoryId: Uuid;
  accountId: Uuid | null;
  counterpartyType: CounterpartyType;
  counterpartyId: Uuid | null;
  amount: number;
  currency: "UAH" | "USD" | "EUR";
  transactionDate: string;
  paymentMethod: string;
  documentNumber: string;
  status: FinanceTransactionStatus;
  comment: string;
  createdById: Uuid | null;
};

export type ProjectPaymentPlan = {
  id: Uuid;
  projectId: Uuid;
  title: string;
  plannedDate: string;
  plannedAmount: number;
  paidAmount: number;
  status: PaymentPlanStatus;
  comment: string;
};

export type PayrollCalcType = "FIXED" | "PERCENT" | "MIXED";
export type PayrollEntryStatus = "DRAFT" | "APPROVED" | "PAID" | "CANCELLED";

export type PayrollEntry = {
  id: Uuid;
  projectId: Uuid;
  /** Обʼєкт монтажу / адреса (опційно; для P&L по обʼєктах). */
  objectId?: Uuid | null;
  employeeId: Uuid | null;
  roleType: string;
  calcType: PayrollCalcType;
  baseAmount: number | null;
  percent: number | null;
  amount: number;
  status: PayrollEntryStatus;
  paymentDate: string | null;
  comment: string;
};

export type ProjectCommissionStatus = "DRAFT" | "APPROVED" | "PAID" | "CANCELLED";
export type CommissionRecipientType =
  | "MANAGER"
  | "PARTNER"
  | "DESIGNER"
  | "MEASURER"
  | "INSTALLER";

export type ProjectCommission = {
  id: Uuid;
  projectId: Uuid;
  recipientType: CommissionRecipientType;
  recipientId: Uuid | null;
  baseType: "CONTRACT" | "INCOME";
  baseAmount: number;
  percent: number | null;
  fixedAmount: number | null;
  calculatedAmount: number;
  status: ProjectCommissionStatus;
  paymentDate: string | null;
  comment: string;
};

export type OperatingCashBreakdown = Record<OperatingCashBucket, number>;

export type ProjectFinancialSummary = {
  projectId: Uuid;
  contractAmount: number;
  plannedExpenses: number;
  /** Грошові витрати (транзакції), без подвійного додавання закупівельних позицій. */
  actualExpenses: number;
  receivedFromClient: number;
  outstandingFromClient: number;
  grossProfit: number;
  netProfit: number;
  payrollTotal: number;
  commissionTotal: number;
  supplierDebt: number;
  clientDebt: number;
  lastCalculatedAt: string | null;
  /** План закупівель (позиції). */
  procurementPlanned: number;
  /** Факт закупівель (позиції, accrual). */
  procurementAccrual: number;
  /** Лише EXPENSE з фінансів. */
  cashExpense: number;
  /** Грошові витрати по статтях (джерело: транзакції + категорії). */
  operatingCashByBucket: OperatingCashBreakdown;
  /** Зобовʼязання по PO (комуітмент), окремо від плану позицій. */
  procurementCommitted: number;
  /** Вартість отриманого по рядках PO (qty × price), шар поставки. */
  procurementReceivedValue: number;
  /** Сума прострочених рядків графіку оплат. */
  overduePlanAmount: number;
  /** Кількість прострочених рядків графіку. */
  overduePlanCount: number;
};

