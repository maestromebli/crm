import type { CalendarEventType as PrismaCalendarEventType } from "@prisma/client";
import type { CalendarEventType } from "./types";

/**
 * Кольори карток подій за типом (ліва смуга + легкий фон).
 * Для типів з БД (зустріч, замір, монтаж, доставка, інше) — насичені відмінні кольори.
 */
export const calendarEventTypeCardClass: Record<CalendarEventType, string> = {
  call: "border-l-4 border-l-violet-500 bg-violet-50/90 border-slate-200",
  meeting: "border-l-4 border-l-sky-500 bg-sky-50/90 border-slate-200",
  measurement: "border-l-4 border-l-amber-500 bg-amber-50/90 border-slate-200",
  follow_up: "border-l-4 border-l-cyan-500 bg-cyan-50/90 border-slate-200",
  proposal_presentation:
    "border-l-4 border-l-indigo-500 bg-indigo-50/90 border-slate-200",
  contract_signing:
    "border-l-4 border-l-purple-600 bg-purple-50/90 border-slate-200",
  handoff: "border-l-4 border-l-teal-600 bg-teal-50/90 border-slate-200",
  production: "border-l-4 border-l-orange-500 bg-orange-50/90 border-slate-200",
  installation: "border-l-4 border-l-emerald-600 bg-emerald-50/90 border-slate-200",
  delivery: "border-l-4 border-l-fuchsia-500 bg-fuchsia-50/90 border-slate-200",
  service: "border-l-4 border-l-lime-600 bg-lime-50/90 border-slate-200",
  internal: "border-l-4 border-l-slate-500 bg-slate-100/90 border-slate-200",
  reminder: "border-l-4 border-l-rose-400 bg-rose-50/90 border-slate-200",
};

/** Плашка типу в деталях події (контрастний фон). */
export const calendarEventTypePillClass: Record<CalendarEventType, string> = {
  call: "bg-violet-600 text-white",
  meeting: "bg-sky-600 text-white",
  measurement: "bg-amber-600 text-white",
  follow_up: "bg-cyan-600 text-white",
  proposal_presentation: "bg-indigo-600 text-white",
  contract_signing: "bg-purple-700 text-white",
  handoff: "bg-teal-700 text-white",
  production: "bg-orange-600 text-white",
  installation: "bg-emerald-700 text-white",
  delivery: "bg-fuchsia-600 text-white",
  service: "bg-lime-700 text-white",
  internal: "bg-slate-600 text-white",
  reminder: "bg-rose-500 text-white",
};

/** Круглі swatches для вибору типу при створенні (відповідають типам Prisma). */
export const prismaCalendarTypeOptions: Array<{
  value: PrismaCalendarEventType;
  uiType: CalendarEventType;
  label: string;
  swatchClass: string;
}> = [
  {
    value: "MEETING",
    uiType: "meeting",
    label: "Зустріч",
    swatchClass: "bg-sky-500",
  },
  {
    value: "MEASUREMENT",
    uiType: "measurement",
    label: "Замір",
    swatchClass: "bg-amber-500",
  },
  {
    value: "INSTALLATION",
    uiType: "installation",
    label: "Монтаж",
    swatchClass: "bg-emerald-600",
  },
  {
    value: "DELIVERY",
    uiType: "delivery",
    label: "Доставка",
    swatchClass: "bg-fuchsia-500",
  },
  {
    value: "OTHER",
    uiType: "internal",
    label: "Інше",
    swatchClass: "bg-slate-500",
  },
];
