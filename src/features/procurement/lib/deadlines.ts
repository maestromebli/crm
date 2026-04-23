/** Відкрита позиція ще може бути поставлена; скасовані не враховуємо. */
export function isOpenProcurementLine(status: string): boolean {
  return !["RECEIVED", "CANCELLED"].includes(status);
}

/** Дедлайн заявки минув відносно ref (дата без часу). */
export function isNeededByPast(neededByDate: string | null | undefined, ref: Date): boolean {
  if (!neededByDate) return false;
  const due = new Date(neededByDate);
  if (Number.isNaN(due.getTime())) return false;
  const startOfRef = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
  const startOfDue = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  return startOfDue < startOfRef;
}

/** Openй рядок із датою «потрібно до» у минулому. */
export function isProcurementLineOverdue(
  neededByDate: string | null | undefined,
  lineStatus: string,
  ref: Date = new Date(),
): boolean {
  if (!isOpenProcurementLine(lineStatus)) return false;
  return isNeededByPast(neededByDate, ref);
}
