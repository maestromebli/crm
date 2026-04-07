/**
 * Хвилини до першого дотику для нового ліда (ENVER: 10 хв за замовчуванням).
 * `LEAD_SLA_FIRST_TOUCH_MINUTES` > `LEAD_SLA_FIRST_TOUCH_HOURS` (конвертація в хв).
 */
export function leadFirstTouchSlaMinutes(): number {
  const m = Number(process.env.LEAD_SLA_FIRST_TOUCH_MINUTES);
  if (Number.isFinite(m) && m > 0) return m;
  const h = Number(process.env.LEAD_SLA_FIRST_TOUCH_HOURS);
  if (Number.isFinite(h) && h > 0) return Math.round(h * 60);
  return 10;
}

/** Години (для сумісності зі старими звітами). */
export function leadFirstTouchSlaHours(): number {
  return leadFirstTouchSlaMinutes() / 60;
}