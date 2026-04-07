import type {
  CalendarEventStatus,
  CalendarEventType,
} from "./types";

export const calendarEventTypeLabel: Record<CalendarEventType, string> = {
  call: "Дзвінок",
  meeting: "Зустріч",
  measurement: "Замір",
  follow_up: "Подальня дія",
  proposal_presentation: "Презентація КП",
  contract_signing: "Підписання договору",
  handoff: "Передача у виробництво",
  production: "Виробництво",
  installation: "Монтаж",
  delivery: "Доставка",
  service: "Сервіс",
  internal: "Внутрішня",
  reminder: "Нагадування",
};

export const calendarEventStatusLabel: Record<CalendarEventStatus, string> = {
  planned: "Заплановано",
  confirmed: "Підтверджено",
  in_progress: "Триває",
  completed: "Завершено",
  canceled: "Скасовано",
  overdue: "Прострочено",
};
