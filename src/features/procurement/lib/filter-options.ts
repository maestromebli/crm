import type { ProcurementItemStatus, ProcurementRequestStatus } from "../types/models";

export const PROCUREMENT_ITEM_STATUS_FILTERS: { value: ProcurementItemStatus; label: string }[] = [
  { value: "DRAFT", label: "Чернетка" },
  { value: "APPROVED", label: "Схвалено" },
  { value: "ORDERED", label: "Замовлено" },
  { value: "PARTIALLY_RECEIVED", label: "Частково отримано" },
  { value: "RECEIVED", label: "Отримано" },
  { value: "CANCELLED", label: "Скасовано" },
];

export const PROCUREMENT_REQUEST_STATUS_FILTERS: { value: ProcurementRequestStatus; label: string }[] = [
  { value: "DRAFT", label: "Чернетка" },
  { value: "PENDING_APPROVAL", label: "На погодженні" },
  { value: "APPROVED", label: "Схвалено" },
  { value: "ORDERED", label: "Замовлено" },
  { value: "PARTIALLY_RECEIVED", label: "Частково отримано" },
  { value: "RECEIVED", label: "Отримано" },
  { value: "CLOSED", label: "Закрито" },
  { value: "CANCELLED", label: "Скасовано" },
];
