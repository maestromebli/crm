/**
 * Довідкові та демонстраційні дані для розширеного бухгалтерського робочого місця.
 * Джерело правди для операційних сум — транзакції/БД; тут — зведення для UI та чек-листів.
 */

export type PrimaryDocumentRow = {
  id: string;
  kind: "RAHUNOK" | "NAKLADNA" | "AKT" | "DOGOVIR" | "INVOICE";
  number: string;
  date: string;
  counterparty: string;
  edrpou: string;
  projectCode: string | null;
  amount: number;
  vatAmount: number;
  status: "DRAFT" | "ISSUED" | "SIGNED" | "PAID" | "CANCELLED";
  vatIncluded: boolean;
};

export type CounterpartyBalanceRow = {
  id: string;
  name: string;
  edrpou: string;
  role: "CLIENT" | "SUPPLIER" | "EMPLOYEE" | "BUDGET";
  debit: number;
  credit: number;
  balance: number;
  agingCurrent: number;
  aging30: number;
  aging60: number;
  aging90Plus: number;
};

export type VatPeriodRow = {
  period: string;
  salesWithVat: number;
  purchaseWithVat: number;
  vatPayable: number;
  vatCredit: number;
  toPay: number;
  filed: boolean;
};

export type PayrollTaxSummary = {
  period: string;
  grossPayroll: number;
  pdfo: number;
  militaryLevy: number;
  esvEmployer: number;
  netToEmployees: number;
};

export type OtherTaxRow = {
  code: string;
  name: string;
  period: string;
  accrual: number;
  paid: number;
  dueDate: string;
  status: "OK" | "DUE" | "OVERDUE";
};

export type CashflowLine = {
  section: "OPERATING" | "INVESTING" | "FINANCING";
  label: string;
  amount: number;
};

export type StatementLine = {
  code: string;
  label: string;
  amount: number;
  indent: number;
};

export type ReconciliationRow = {
  bankAccount: string;
  statementBalance: number;
  bookBalance: number;
  unmatched: number;
  lastStmtDate: string;
  status: "MATCHED" | "ATTENTION";
};

export type PeriodCloseTask = {
  id: string;
  label: string;
  done: boolean;
  owner: string;
};

export type ChartAccountRow = {
  code: string;
  name: string;
  type: "ASSET" | "LIABILITY" | "EQUITY" | "INCOME" | "EXPENSE";
  balance: number;
};

export type FixedAssetRow = {
  id: string;
  name: string;
  invNumber: string;
  acquisitionDate: string;
  initialCost: number;
  depreciationAccum: number;
  residual: number;
  usefulMonthsLeft: number;
};

export type BudgetRow = {
  category: string;
  budgetMonth: number;
  actualMonth: number;
  variance: number;
  comment: string;
};

export type ComplianceDeadline = {
  id: string;
  title: string;
  dueDate: string;
  authority: string;
  priority: "HIGH" | "MEDIUM" | "LOW";
};

export type AuditLogRow = {
  id: string;
  at: string;
  user: string;
  action: string;
  entity: string;
  detail: string;
};

export const PRIMARY_DOCUMENTS_DEMO: PrimaryDocumentRow[] = [
  {
    id: "pd-1",
    kind: "RAHUNOK",
    number: "РН-2401",
    date: "2026-03-28",
    counterparty: 'ТОВ "Клієнт Альфа"',
    edrpou: "12345678",
    projectCode: "PRJ-104",
    amount: 185000,
    vatAmount: 30833.33,
    status: "PAID",
    vatIncluded: true,
  },
  {
    id: "pd-2",
    kind: "AKT",
    number: "АВ-18",
    date: "2026-03-30",
    counterparty: 'ТОВ "Клієнт Альфа"',
    edrpou: "12345678",
    projectCode: "PRJ-104",
    amount: 95000,
    vatAmount: 15833.33,
    status: "SIGNED",
    vatIncluded: true,
  },
  {
    id: "pd-3",
    kind: "NAKLADNA",
    number: "НВ-992",
    date: "2026-03-22",
    counterparty: 'ТОВ "Постачальник Бета"',
    edrpou: "87654321",
    projectCode: "PRJ-102",
    amount: 42000,
    vatAmount: 7000,
    status: "ISSUED",
    vatIncluded: true,
  },
];

export const COUNTERPARTY_BALANCES_DEMO: CounterpartyBalanceRow[] = [
  {
    id: "cp-1",
    name: 'ТОВ "Клієнт Альфа"',
    edrpou: "12345678",
    role: "CLIENT",
    debit: 312000,
    credit: 198000,
    balance: 114000,
    agingCurrent: 80000,
    aging30: 34000,
    aging60: 0,
    aging90Plus: 0,
  },
  {
    id: "cp-2",
    name: 'ТОВ "Постачальник Бета"',
    edrpou: "87654321",
    role: "SUPPLIER",
    debit: 0,
    credit: 62000,
    balance: -62000,
    agingCurrent: 42000,
    aging30: 20000,
    aging60: 0,
    aging90Plus: 0,
  },
  {
    id: "cp-3",
    name: "Податкова (ПДВ з авансу)",
    edrpou: "00000000",
    role: "BUDGET",
    debit: 15000,
    credit: 0,
    balance: 15000,
    agingCurrent: 15000,
    aging30: 0,
    aging60: 0,
    aging90Plus: 0,
  },
];

export const VAT_PERIODS_DEMO: VatPeriodRow[] = [
  {
    period: "2026-02",
    salesWithVat: 428000,
    purchaseWithVat: 265000,
    vatPayable: 71333.33,
    vatCredit: 44166.67,
    toPay: 27166.66,
    filed: true,
  },
  {
    period: "2026-03",
    salesWithVat: 512000,
    purchaseWithVat: 301000,
    vatPayable: 85333.33,
    vatCredit: 50166.67,
    toPay: 35166.66,
    filed: false,
  },
];

export const PAYROLL_TAXES_DEMO: PayrollTaxSummary[] = [
  {
    period: "2026-03",
    grossPayroll: 186500,
    pdfo: 26110,
    militaryLevy: 2797.5,
    esvEmployer: 40930,
    netToEmployees: 157592.5,
  },
];

export const OTHER_TAXES_DEMO: OtherTaxRow[] = [
  {
    code: "ESV",
    name: "ЄСВ (зарплатний, сплата)",
    period: "2026-03",
    accrual: 40930,
    paid: 40930,
    dueDate: "2026-04-20",
    status: "OK",
  },
  {
    code: "PDFO",
    name: "ПДФО та військовий збір (утримання)",
    period: "2026-03",
    accrual: 28907.5,
    paid: 0,
    dueDate: "2026-04-20",
    status: "DUE",
  },
  {
    code: "EP",
    name: "Єдиний податок (група 3)",
    period: "2026-Q1",
    accrual: 28500,
    paid: 0,
    dueDate: "2026-05-12",
    status: "DUE",
  },
];

/** Детальні рядки без проміжних підсумків — підсумки по секціях рахуються в UI. */
export const CASHFLOW_DEMO: CashflowLine[] = [
  { section: "OPERATING", label: "Надходження від клієнтів", amount: 612000 },
  { section: "OPERATING", label: "Оплата постачальникам", amount: -398000 },
  { section: "OPERATING", label: "Зарплата та податки з ФОП", amount: -224000 },
  { section: "INVESTING", label: "Купівля ОЗ / обладнання", amount: -85000 },
  { section: "FINANCING", label: "Надходження за кредитом / позикою", amount: 120000 },
];

export const BALANCE_SHEET_DEMO: StatementLine[] = [
  { code: "I", label: "Актив", amount: 0, indent: 0 },
  { code: "101", label: "Каса, розрахунковий рахунок", amount: 184200, indent: 1 },
  { code: "181", label: "Дебіторська заборгованість клієнтів", amount: 114000, indent: 1 },
  { code: "209", label: "Інші оборотні активи", amount: 42000, indent: 1 },
  { code: "10", label: "Основні засоби (залишкова вартість)", amount: 210000, indent: 1 },
  { code: "A", label: "Разом актив", amount: 550200, indent: 0 },
  { code: "II", label: "Пасив", amount: 0, indent: 0 },
  { code: "601", label: "Кредиторська заборгованість", amount: 98000, indent: 1 },
  { code: "641", label: "Податки та збори", amount: 35166, indent: 1 },
  { code: "401", label: "Статутний капітал", amount: 200000, indent: 1 },
  { code: "443", label: "Нерозподілений прибуток (оціночно)", amount: 217034, indent: 1 },
  { code: "P", label: "Разом пасив", amount: 550200, indent: 0 },
];

export const PNL_DEMO: StatementLine[] = [
  { code: "70", label: "Дохід від реалізації продукції", amount: 980000, indent: 0 },
  { code: "90", label: "Собівартість реалізованої продукції", amount: -612000, indent: 0 },
  { code: "91", label: "Інші операційні витрати", amount: -118000, indent: 0 },
  { code: "92", label: "Адміністративні витрати", amount: -95000, indent: 0 },
  { code: "93", label: "Витрати на збут", amount: -42000, indent: 0 },
  { code: "NP", label: "Чистий фінансовий результат (оціночно)", amount: 113000, indent: 0 },
];

export const RECONCILIATION_DEMO: ReconciliationRow[] = [
  {
    bankAccount: "UA12 305299 00000 26001234567890 (Приват)",
    statementBalance: 184200,
    bookBalance: 183950,
    unmatched: 250,
    lastStmtDate: "2026-03-31",
    status: "ATTENTION",
  },
  {
    bankAccount: "UA21 300647 00000 26009876543210 (Ощад)",
    statementBalance: 45200,
    bookBalance: 45200,
    unmatched: 0,
    lastStmtDate: "2026-03-30",
    status: "MATCHED",
  },
];

export const PERIOD_CLOSE_CHECKLIST: PeriodCloseTask[] = [
  { id: "t1", label: "Первинні документи за місяць зібрані та пронумеровані", done: true, owner: "Бухгалтер" },
  { id: "t2", label: "Банківські виписки імпортовані та звірені", done: true, owner: "Бухгалтер" },
  { id: "t3", label: "Нарахування зарплати, ПДФО, військового, ЄСВ відображені", done: false, owner: "Бухгалтер" },
  { id: "t4", label: "ПДВ: реєстри сформовані, декларація підготовлена", done: false, owner: "Головний бухгалтер" },
  { id: "t5", label: "Амортизація ОЗ та інвентаризація запасів", done: false, owner: "Бухгалтер" },
  { id: "t6", label: "Закриття рахунків 7–9 класів, перенос на фінансовий результат", done: false, owner: "Головний бухгалтер" },
];

export const CHART_OF_ACCOUNTS_SAMPLE: ChartAccountRow[] = [
  { code: "10", name: "Основні засоби", type: "ASSET", balance: 210000 },
  { code: "26", name: "Готова продукція", type: "ASSET", balance: 18000 },
  { code: "301", name: "Каса в національній валюті", type: "ASSET", balance: 1200 },
  { code: "311", name: "Поточні рахунки в банку", type: "ASSET", balance: 183000 },
  { code: "361", name: "Розрахунки з покупцями", type: "ASSET", balance: 114000 },
  { code: "601", name: "Розрахунки з постачальниками", type: "LIABILITY", balance: 62000 },
  { code: "641", name: "Розрахунки за податками", type: "LIABILITY", balance: 35166 },
  { code: "401", name: "Статутний капітал", type: "EQUITY", balance: 200000 },
  { code: "70", name: "Доходи від реалізації", type: "INCOME", balance: 980000 },
  { code: "90", name: "Собівартість реалізованої продукції", type: "EXPENSE", balance: 612000 },
];

export const FIXED_ASSETS_DEMO: FixedAssetRow[] = [
  {
    id: "fa-1",
    name: "Форматно-розкрійний верстат",
    invNumber: "ОЗ-2019-04",
    acquisitionDate: "2019-06-12",
    initialCost: 480000,
    depreciationAccum: 312000,
    residual: 168000,
    usefulMonthsLeft: 28,
  },
  {
    id: "fa-2",
    name: "Автомобіль службовий",
    invNumber: "ОЗ-2021-01",
    acquisitionDate: "2021-03-01",
    initialCost: 820000,
    depreciationAccum: 410000,
    residual: 410000,
    usefulMonthsLeft: 48,
  },
];

export const BUDGET_VS_ACTUAL_DEMO: BudgetRow[] = [
  { category: "ФОП та нарахування", budgetMonth: 190000, actualMonth: 186500, variance: -3500, comment: "У межах плану" },
  { category: "Матеріали (проєкти)", budgetMonth: 320000, actualMonth: 338000, variance: 18000, comment: "Перевищення: закупівля фасаду" },
  { category: "Монтаж субпідряд", budgetMonth: 85000, actualMonth: 79200, variance: -5800, comment: "Економія по двох об'єктах" },
  { category: "Логістика та доставка", budgetMonth: 24000, actualMonth: 26100, variance: 2100, comment: "Паливо" },
];

export const COMPLIANCE_DEADLINES_DEMO: ComplianceDeadline[] = [
  {
    id: "c1",
    title: "Декларація з ПДВ (поточний податковий період)",
    dueDate: "2026-04-20",
    authority: "ДПС",
    priority: "HIGH",
  },
  {
    id: "c2",
    title: "Єдиний соціальний внесок (нарахований за попередній місяць)",
    dueDate: "2026-04-20",
    authority: "ПФУ / ДПС",
    priority: "HIGH",
  },
  {
    id: "c3",
    title: "ПДФО та військовий збір (утриманий за попередній місяць)",
    dueDate: "2026-04-20",
    authority: "ДПС",
    priority: "HIGH",
  },
  {
    id: "c4",
    title: "Звітність з праці (форма № 1-ДФ за квартал)",
    dueDate: "2026-05-12",
    authority: "ДПС",
    priority: "MEDIUM",
  },
  {
    id: "c5",
    title: "Фінансова звітність (річна) — подання",
    dueDate: "2026-03-01",
    authority: "ДПС / реєстратор",
    priority: "LOW",
  },
];

export const AUDIT_LOG_DEMO: AuditLogRow[] = [
  {
    id: "a1",
    at: "2026-03-31 18:04",
    user: "Олена К.",
    action: "Зміна статусу",
    entity: "FinanceTransaction",
    detail: "tx-… · підтверджено оплату 95 000 грн",
  },
  {
    id: "a2",
    at: "2026-03-31 17:22",
    user: "Система",
    action: "Імпорт виписки",
    entity: "BankIntegration",
    detail: "ПриватБанк · 142 рядки · 3 без зіставлення",
  },
  {
    id: "a3",
    at: "2026-03-30 09:10",
    user: "Ігор П.",
    action: "Експорт CSV",
    entity: "FinanceRegistry",
    detail: "Реєстр об'єктів · 28 рядків",
  },
];

export function statusUaPrimaryDoc(status: PrimaryDocumentRow["status"]): string {
  const m: Record<PrimaryDocumentRow["status"], string> = {
    DRAFT: "Чернетка",
    ISSUED: "Видано",
    SIGNED: "Підписано",
    PAID: "Оплачено",
    CANCELLED: "Скасовано",
  };
  return m[status];
}

export function kindUaPrimaryDoc(kind: PrimaryDocumentRow["kind"]): string {
  const m: Record<PrimaryDocumentRow["kind"], string> = {
    RAHUNOK: "Рахунок",
    NAKLADNA: "Накладна",
    AKT: "Акт виконаних робіт",
    DOGOVIR: "Договір",
    INVOICE: "Інвойс",
  };
  return m[kind];
}

export function roleUaCounterparty(role: CounterpartyBalanceRow["role"]): string {
  const m: Record<CounterpartyBalanceRow["role"], string> = {
    CLIENT: "Клієнт",
    SUPPLIER: "Постачальник",
    EMPLOYEE: "Працівник",
    BUDGET: "Бюджет / податок",
  };
  return m[role];
}
