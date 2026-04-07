const YMD = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * `nextStepDate` у PATCH: `YYYY-MM-DD` → момент UTC (полудень) для стабільного календарного дня.
 */
export function nextStepDateStringToDate(isoDay: string): Date | null {
  const m = YMD.exec(isoDay.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(y, mo - 1, d, 12, 0, 0, 0));
  return Number.isNaN(dt.getTime()) ? null : dt;
}

/** Для відповіді API / поля форми `type="date"` (UTC календарний день). */
export function dateToNextStepDateString(
  dt: Date | null | undefined,
): string | null {
  if (!dt) return null;
  const d = new Date(dt);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getUTCFullYear();
  const mo = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${mo}-${day}`;
}
