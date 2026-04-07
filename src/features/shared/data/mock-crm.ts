import type {
  FinanceAccount,
  FinanceCategory,
  FinanceTransaction,
  PayrollEntry,
  ProjectCommission,
  ProjectPaymentPlan,
} from "../../finance/types/models";
import type {
  GoodsReceipt,
  GoodsReceiptItem,
  ProcurementCategory,
  ProcurementItem,
  ProcurementRequest,
  PurchaseOrder,
  PurchaseOrderItem,
  Supplier,
} from "../../procurement/types/models";
import type { Client, Project, ProjectObject } from "../types/entities";

const id = (p: string, n: number): string => `${p}-${String(n).padStart(3, "0")}`;

export const mockClients: Client[] = [
  { id: id("client", 1), name: "ТОВ МЕГАХОЛ", type: "COMPANY" },
  { id: id("client", 2), name: "Ірина Мельник", type: "PERSON" },
  { id: id("client", 3), name: "Сергій Бондар", type: "PERSON" },
  { id: id("client", 4), name: "ТОВ SKY GARDEN", type: "COMPANY" },
  { id: id("client", 5), name: "Олена Дорош", type: "PERSON" },
];

export const mockProjects: Project[] = [
  {
    id: id("proj", 1),
    code: "EN-2026-001",
    title: "Кухня + шафи, ЖК River Park",
    clientId: id("client", 1),
    managerId: "user-001",
    status: "IN_WORK",
    contractAmount: 1240000,
    currency: "UAH",
    plannedMargin: 0.24,
    actualMargin: 0.21,
    startDate: "2026-03-01",
    dueDate: "2026-05-10",
    notes: "",
  },
  {
    id: id("proj", 2),
    code: "EN-2026-002",
    title: "Шафа-гардероб, вул. Саперне Поле",
    clientId: id("client", 2),
    managerId: "user-002",
    status: "APPROVED",
    contractAmount: 380000,
    currency: "UAH",
    plannedMargin: 0.27,
    actualMargin: 0.25,
    startDate: "2026-03-15",
    dueDate: "2026-04-18",
    notes: "",
  },
  {
    id: id("proj", 3),
    code: "EN-2026-003",
    title: "Офісні меблі, БЦ Horizon",
    clientId: id("client", 4),
    managerId: "user-003",
    status: "IN_WORK",
    contractAmount: 2150000,
    currency: "UAH",
    plannedMargin: 0.22,
    actualMargin: 0.19,
    startDate: "2026-02-20",
    dueDate: "2026-06-01",
    notes: "",
  },
  {
    id: id("proj", 4),
    code: "EN-2026-004",
    title: "Дитяча + гардероб, ЖК Французький квартал",
    clientId: id("client", 5),
    managerId: "user-001",
    status: "COMPLETED",
    contractAmount: 620000,
    currency: "UAH",
    plannedMargin: 0.23,
    actualMargin: 0.26,
    startDate: "2026-01-11",
    dueDate: "2026-03-01",
    notes: "",
  },
  {
    id: id("proj", 5),
    code: "EN-2026-005",
    title: "Кухня premium, Obolon Residences",
    clientId: id("client", 3),
    managerId: "user-004",
    status: "LEAD",
    contractAmount: 0,
    currency: "UAH",
    plannedMargin: null,
    actualMargin: null,
    startDate: null,
    dueDate: null,
    notes: "Очікуємо фінальне погодження",
  },
];

export const mockProjectObjects: ProjectObject[] = mockProjects.map((p, i) => ({
  id: id("obj", i + 1),
  projectId: p.id,
  title: `Обʼєкт ${i + 1}`,
  objectType: i % 2 === 0 ? "Квартира" : "Офіс",
  address: `м. Київ, адреса ${i + 10}`,
  notes: "",
}));

export const mockFinanceAccounts: FinanceAccount[] = [
  { id: id("fa", 1), name: "Каса UAH", type: "CASH", currency: "UAH", isActive: true },
  { id: id("fa", 2), name: "Р/р ПриватБанк", type: "BANK", currency: "UAH", isActive: true },
  { id: id("fa", 3), name: "Картка Monobank", type: "CARD", currency: "UAH", isActive: true },
];

export const mockFinanceCategories: FinanceCategory[] = [
  { id: id("fc", 1), name: "Аванс клієнта", group: "INCOME", color: "#16a34a", sortOrder: 1, isSystem: true },
  { id: id("fc", 2), name: "Доплата клієнта", group: "INCOME", color: "#16a34a", sortOrder: 2, isSystem: true },
  { id: id("fc", 3), name: "Фінальний платіж", group: "INCOME", color: "#16a34a", sortOrder: 3, isSystem: true },
  { id: id("fc", 4), name: "Матеріали", group: "EXPENSE", color: "#dc2626", sortOrder: 10, isSystem: true, operatingBucket: "MATERIALS" },
  { id: id("fc", 5), name: "Підрядники", group: "EXPENSE", color: "#b91c1c", sortOrder: 11, isSystem: true, operatingBucket: "SUBCONTRACTORS" },
  { id: id("fc", 6), name: "Логістика", group: "EXPENSE", color: "#ef4444", sortOrder: 12, isSystem: true, operatingBucket: "LOGISTICS" },
  { id: id("fc", 7), name: "Замір", group: "EXPENSE", color: "#f97316", sortOrder: 13, isSystem: true, operatingBucket: "MEASURING" },
  { id: id("fc", 8), name: "Конструктор", group: "EXPENSE", color: "#ea580c", sortOrder: 14, isSystem: true, operatingBucket: "CONSTRUCTOR" },
  { id: id("fc", 9), name: "Збірка", group: "EXPENSE", color: "#fb923c", sortOrder: 15, isSystem: true, operatingBucket: "ASSEMBLY" },
  { id: id("fc", 10), name: "Установка", group: "EXPENSE", color: "#fdba74", sortOrder: 16, isSystem: true, operatingBucket: "INSTALLATION" },
  { id: id("fc", 11), name: "Зарплата", group: "PAYROLL", color: "#f59e0b", sortOrder: 20, isSystem: true, operatingBucket: "PAYROLL" },
  { id: id("fc", 12), name: "Комісії", group: "COMMISSION", color: "#8b5cf6", sortOrder: 30, isSystem: true, operatingBucket: "COMMISSIONS" },
];

const expenseCategoryCycle = [4, 5, 6, 7, 8, 9, 10] as const;

const objectIdByProjectId = new Map(
  mockProjectObjects.map((o) => [o.projectId, o.id] as const),
);

export const mockTransactions: FinanceTransaction[] = Array.from({ length: 36 }).map((_, i) => {
  const project = mockProjects[i % 4];
  const type =
    i % 6 === 0
      ? "INCOME"
      : i % 6 === 1
        ? "EXPENSE"
        : i % 6 === 2
          ? "PAYROLL"
          : i % 6 === 3
            ? "COMMISSION"
            : i % 6 === 4
              ? "EXPENSE"
              : "INCOME";
  const categoryId =
    type === "INCOME"
      ? id("fc", (i % 3) + 1)
      : type === "EXPENSE"
        ? id("fc", expenseCategoryCycle[i % expenseCategoryCycle.length])
        : type === "PAYROLL"
          ? id("fc", 11)
          : id("fc", 12);
  const amount = type === "INCOME" ? 120000 + i * 5000 : 18000 + i * 1200;
  return {
    id: id("ft", i + 1),
    projectId: project.id,
    objectId: objectIdByProjectId.get(project.id) ?? null,
    type,
    categoryId,
    accountId: mockFinanceAccounts[i % mockFinanceAccounts.length].id,
    counterpartyType: type === "INCOME" ? "CLIENT" : "SUPPLIER",
    counterpartyId: null,
    amount,
    currency: "UAH",
    transactionDate: `2026-0${(i % 4) + 1}-${String((i % 27) + 1).padStart(2, "0")}`,
    paymentMethod: i % 2 === 0 ? "Безготівка" : "Готівка",
    documentNumber: `DOC-${1000 + i}`,
    status: "CONFIRMED",
    comment: i % 5 === 0 ? "Термінова оплата" : "",
    createdById: "user-acc-001",
  };
});

export const mockPaymentPlan: ProjectPaymentPlan[] = Array.from({ length: 14 }).map((_, i) => ({
  id: id("pp", i + 1),
  projectId: mockProjects[i % 4].id,
  title: i % 3 === 0 ? "Аванс" : i % 3 === 1 ? "Проміжний платіж" : "Фінальний платіж",
  /** Деякі дати в минулому для демо прострочень (березень 2026 = «сьогодні» в контексті демо). */
  plannedDate:
    i % 7 === 0
      ? "2026-02-10"
      : i % 7 === 1
        ? "2026-02-28"
        : `2026-0${(i % 5) + 3}-${String((i % 20) + 1).padStart(2, "0")}`,
  plannedAmount: 120000 + i * 15000,
  paidAmount: i % 3 === 0 ? 120000 : i % 3 === 1 ? 60000 : 0,
  status:
    i % 7 === 0 && i % 3 !== 0
      ? "OVERDUE"
      : i % 3 === 0
        ? "PAID"
        : i % 3 === 1
          ? "PARTIALLY_PAID"
          : "PLANNED",
  comment: i % 7 === 0 && i % 3 !== 0 ? "Прострочено — нагадати клієнту" : "",
}));

export const mockPayroll: PayrollEntry[] = Array.from({ length: 6 }).map((_, i) => ({
  id: id("pr", i + 1),
  projectId: mockProjects[i % 4].id,
  objectId: objectIdByProjectId.get(mockProjects[i % 4].id) ?? null,
  employeeId: null,
  roleType: ["Замір", "Установка", "Збірка", "Конструктор"][i % 4],
  calcType: i % 2 === 0 ? "FIXED" : "PERCENT",
  baseAmount: i % 2 === 0 ? 18000 + i * 1000 : 250000,
  percent: i % 2 === 0 ? null : 3 + i,
  amount: 18000 + i * 2200,
  status: i % 3 === 0 ? "PAID" : "APPROVED",
  paymentDate: i % 3 === 0 ? `2026-0${(i % 4) + 1}-22` : null,
  comment: "",
}));

export const mockCommissions: ProjectCommission[] = Array.from({ length: 5 }).map((_, i) => ({
  id: id("cm", i + 1),
  projectId: mockProjects[i % 4].id,
  recipientType: i % 2 === 0 ? "MANAGER" : "PARTNER",
  recipientId: null,
  baseType: "CONTRACT",
  baseAmount: mockProjects[i % 4].contractAmount,
  percent: i % 2 === 0 ? 2.5 : 1.8,
  fixedAmount: null,
  calculatedAmount: Math.round((mockProjects[i % 4].contractAmount * (i % 2 === 0 ? 2.5 : 1.8)) / 100),
  status: i % 3 === 0 ? "PAID" : "APPROVED",
  paymentDate: i % 3 === 0 ? `2026-0${(i % 4) + 1}-27` : null,
  comment: "",
}));

export const mockSuppliers: Supplier[] = [
  { id: id("sup", 1), name: "ДСП Центр", type: "MATERIAL", contactPerson: "Іван Гнатюк", phone: "+380671111111", email: "sales@dsp.ua", paymentTerms: "50/50", notes: "", isActive: true },
  { id: id("sup", 2), name: "Фасад Лайн", type: "MATERIAL", contactPerson: "Олег С.", phone: "+380672222222", email: "hello@fasad.ua", paymentTerms: "70/30", notes: "", isActive: true },
  { id: id("sup", 3), name: "Фурнітура PRO", type: "MATERIAL", contactPerson: "Марія Д.", phone: "+380673333333", email: "b2b@furnit.ua", paymentTerms: "100% передоплата", notes: "", isActive: true },
  { id: id("sup", 4), name: "Скло Київ", type: "OUTSOURCE", contactPerson: "Вадим", phone: "+380674444444", email: "glass@kyiv.ua", paymentTerms: "після отримання", notes: "", isActive: true },
  { id: id("sup", 5), name: "Логістик Транс", type: "LOGISTICS", contactPerson: "Петро", phone: "+380675555555", email: "fleet@lt.ua", paymentTerms: "щотижнево", notes: "", isActive: true },
  { id: id("sup", 6), name: "Монтаж Сервіс", type: "SERVICE", contactPerson: "Роман", phone: "+380676666666", email: "work@montage.ua", paymentTerms: "акт + 3 дні", notes: "", isActive: true },
  { id: id("sup", 7), name: "ЕлектроСвітло", type: "MATERIAL", contactPerson: "Людмила", phone: "+380677777777", email: "sales@light.ua", paymentTerms: "50/50", notes: "", isActive: true },
  { id: id("sup", 8), name: "СТО Cargo", type: "LOGISTICS", contactPerson: "Юрій", phone: "+380678888888", email: "dispatch@cargo.ua", paymentTerms: "факт рейсу", notes: "", isActive: true },
];

export const mockProcurementCategories: ProcurementCategory[] = [
  "ДСП",
  "Фасади",
  "Фурнітура",
  "Стільниця",
  "Скло",
  "Підсвітка",
  "Замір",
  "Установка",
  "Збірка",
  "Конструктор",
  "Логістика",
].map((name, i) => ({
  id: id("pc", i + 1),
  name,
  group:
    name === "Логістика"
      ? "LOGISTICS"
      : name === "Замір" || name === "Установка" || name === "Збірка" || name === "Конструктор"
        ? "LABOR"
        : "MATERIAL",
  sortOrder: i + 1,
}));

export const mockProcurementRequests: ProcurementRequest[] = Array.from({ length: 15 }).map((_, i) => ({
  id: id("prq", i + 1),
  projectId: mockProjects[i % 4].id,
  objectId: mockProjectObjects[i % 4].id,
  requestedById: "user-prc-001",
  status:
    i % 6 === 0
      ? "ORDERED"
      : i % 6 === 1
        ? "APPROVED"
        : i % 6 === 2
          ? "PENDING_APPROVAL"
          : i % 6 === 3
            ? "PARTIALLY_RECEIVED"
            : i % 6 === 4
              ? "RECEIVED"
              : "DRAFT",
  neededByDate: `2026-0${(i % 5) + 1}-${String((i % 24) + 1).padStart(2, "0")}`,
  budgetTotal: 40000 + i * 7000,
  actualTotal: 35000 + i * 6200,
  comment: "",
}));

export const mockProcurementItems: ProcurementItem[] = Array.from({ length: 40 }).map((_, i) => {
  const req = mockProcurementRequests[i % mockProcurementRequests.length];
  const qty = 2 + (i % 8);
  const plannedUnitCost = 1200 + i * 90;
  const actualUnitCost = i % 5 === 0 ? plannedUnitCost * 1.12 : plannedUnitCost * 0.98;
  return {
    id: id("pi", i + 1),
    requestId: req.id,
    projectId: req.projectId,
    objectId: req.objectId,
    categoryId: mockProcurementCategories[i % mockProcurementCategories.length].id,
    itemType: mockProcurementCategories[i % mockProcurementCategories.length].group,
    name: `Позиція ${i + 1}`,
    article: `ART-${500 + i}`,
    unit: i % 2 === 0 ? "шт" : "м2",
    qty,
    plannedUnitCost,
    plannedTotalCost: Math.round(qty * plannedUnitCost),
    actualUnitCost: Math.round(actualUnitCost),
    actualTotalCost: Math.round(qty * actualUnitCost),
    supplierId: mockSuppliers[i % mockSuppliers.length].id,
    status: i % 4 === 0 ? "RECEIVED" : i % 4 === 1 ? "ORDERED" : "APPROVED",
    isCustom: i % 7 === 0,
    comment: "",
  };
});

export const mockPurchaseOrders: PurchaseOrder[] = Array.from({ length: 8 }).map((_, i) => ({
  id: id("po", i + 1),
  supplierId: mockSuppliers[i % mockSuppliers.length].id,
  projectId: mockProjects[i % 4].id,
  requestId: mockProcurementRequests[i % mockProcurementRequests.length].id,
  orderNumber: `PO-2026-${String(i + 1).padStart(3, "0")}`,
  status:
    i % 5 === 0
      ? "PARTIALLY_DELIVERED"
      : i % 5 === 1
        ? "DELIVERED"
        : i % 5 === 2
          ? "PAID"
          : i % 5 === 3
            ? "CONFIRMED"
            : "SENT",
  orderDate: `2026-0${(i % 4) + 1}-${String((i % 22) + 1).padStart(2, "0")}`,
  expectedDate: `2026-0${(i % 4) + 2}-${String((i % 22) + 1).padStart(2, "0")}`,
  totalAmount: 90000 + i * 18000,
  comment: "",
}));

export const mockPurchaseOrderItems: PurchaseOrderItem[] = Array.from({ length: 20 }).map((_, i) => {
  const qty = 5 + (i % 7);
  const price = 1500 + i * 120;
  const total = qty * price;
  return {
    id: id("poi", i + 1),
    purchaseOrderId: mockPurchaseOrders[i % mockPurchaseOrders.length].id,
    procurementItemId: mockProcurementItems[i % mockProcurementItems.length].id,
    name: `Позиція замовлення ${i + 1}`,
    article: `PO-ART-${700 + i}`,
    unit: "шт",
    qty,
    price,
    total,
    receivedQty: i % 3 === 0 ? qty : i % 3 === 1 ? qty / 2 : 0,
  };
});

export const mockGoodsReceipts: GoodsReceipt[] = Array.from({ length: 8 }).map((_, i) => ({
  id: id("gr", i + 1),
  purchaseOrderId: mockPurchaseOrders[i % mockPurchaseOrders.length].id,
  projectId: mockProjects[i % 4].id,
  receiptDate: `2026-0${(i % 4) + 2}-${String((i % 24) + 1).padStart(2, "0")}`,
  receivedById: "user-prc-001",
  comment: i % 3 === 0 ? "Часткова поставка" : "",
}));

export const mockGoodsReceiptItems: GoodsReceiptItem[] = Array.from({ length: 16 }).map((_, i) => ({
  id: id("gri", i + 1),
  receiptId: mockGoodsReceipts[i % mockGoodsReceipts.length].id,
  purchaseOrderItemId: mockPurchaseOrderItems[i % mockPurchaseOrderItems.length].id,
  receivedQty: 3 + (i % 5),
  acceptedQty: 3 + (i % 4),
  damagedQty: i % 7 === 0 ? 1 : 0,
  comment: i % 7 === 0 ? "Пошкоджено при доставці" : "",
}));

