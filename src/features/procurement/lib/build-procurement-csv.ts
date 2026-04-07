import { CSV_UTF8_BOM, csvRow } from "../../../lib/csv";
import { formatMoneyUa } from "../../finance/lib/format-money";
import type {
  GoodsReceipt,
  ProcurementItem,
  ProcurementRequest,
  PurchaseOrder,
  Supplier,
} from "../types/models";

export type ProcurementCsvPayload = {
  requests: ProcurementRequest[];
  items: ProcurementItem[];
  purchaseOrders: PurchaseOrder[];
  suppliers: Supplier[];
  receipts: GoodsReceipt[];
  projectNameById: Record<string, string>;
  supplierNameById: Record<string, string>;
  categoryNameById: Record<string, string>;
  orderNumberById: Record<string, string>;
  neededByDateByRequestId: Record<string, string | null>;
};

/** Повний вміст CSV (з UTF-8 BOM) для Excel. */
export function buildProcurementCsvString(payload: ProcurementCsvPayload): string {
  const {
    requests,
    items,
    purchaseOrders,
    suppliers,
    receipts,
    projectNameById,
    supplierNameById,
    categoryNameById,
    orderNumberById,
    neededByDateByRequestId,
  } = payload;

  const lines: string[] = [];

  lines.push("# ЗАЯВКИ");
  lines.push(csvRow(["Проєкт", "Статус", "Потрібно до", "Бюджет", "Факт", "Коментар"]));
  for (const r of requests) {
    lines.push(
      csvRow([
        projectNameById[r.projectId] ?? r.projectId,
        r.status,
        r.neededByDate ?? "",
        formatMoneyUa(r.budgetTotal),
        formatMoneyUa(r.actualTotal),
        r.comment,
      ]),
    );
  }

  lines.push("");
  lines.push("# ПОЗИЦІЇ");
  lines.push(
    csvRow([
      "Проєкт",
      "Потрібно до (заявка)",
      "Категорія",
      "Назва",
      "Артикул",
      "К-сть",
      "План од.",
      "План всього",
      "Факт од.",
      "Факт всього",
      "Постачальник",
      "Статус",
    ]),
  );
  for (const i of items) {
    const need = neededByDateByRequestId[i.requestId] ?? "";
    lines.push(
      csvRow([
        projectNameById[i.projectId] ?? i.projectId,
        need,
        categoryNameById[i.categoryId] ?? i.categoryId,
        i.name,
        i.article ?? "",
        i.qty,
        formatMoneyUa(i.plannedUnitCost),
        formatMoneyUa(i.plannedTotalCost),
        i.actualUnitCost != null ? formatMoneyUa(i.actualUnitCost) : "",
        i.actualTotalCost != null ? formatMoneyUa(i.actualTotalCost) : "",
        i.supplierId ? supplierNameById[i.supplierId] ?? "" : "",
        i.status,
      ]),
    );
  }

  lines.push("");
  lines.push("# ЗАМОВЛЕННЯ (PO)");
  lines.push(
    csvRow([
      "Номер PO",
      "Проєкт",
      "Постачальник",
      "Статус",
      "Дата",
      "Очікувана дата",
      "Сума",
      "Коментар",
    ]),
  );
  for (const o of purchaseOrders) {
    lines.push(
      csvRow([
        o.orderNumber,
        projectNameById[o.projectId] ?? o.projectId,
        supplierNameById[o.supplierId] ?? o.supplierId,
        o.status,
        o.orderDate,
        o.expectedDate ?? "",
        formatMoneyUa(o.totalAmount),
        o.comment,
      ]),
    );
  }

  lines.push("");
  lines.push("# ПОСТАВКИ");
  lines.push(csvRow(["Дата", "PO", "Проєкт", "Коментар"]));
  for (const g of receipts) {
    lines.push(
      csvRow([
        g.receiptDate,
        orderNumberById[g.purchaseOrderId] ?? g.purchaseOrderId,
        projectNameById[g.projectId] ?? g.projectId,
        g.comment,
      ]),
    );
  }

  lines.push("");
  lines.push("# ПОСТАЧАЛЬНИКИ (довідник)");
  lines.push(csvRow(["Назва", "Тип", "Контакт", "Телефон", "Email", "Умови оплати", "Активний"]));
  for (const s of suppliers) {
    lines.push(
      csvRow([s.name, s.type, s.contactPerson, s.phone, s.email, s.paymentTerms, s.isActive ? "так" : "ні"]),
    );
  }

  return CSV_UTF8_BOM + lines.join("\r\n");
}

export function procurementCsvHasRows(payload: ProcurementCsvPayload): boolean {
  return (
    payload.requests.length +
      payload.items.length +
      payload.purchaseOrders.length +
      payload.receipts.length +
      payload.suppliers.length >
    0
  );
}
