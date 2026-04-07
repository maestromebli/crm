/**
 * Нормалізація грошових сум з БД (Decimal) та JS (number) у number з 2 знаками.
 */
export function moneyFromDb(value: unknown): number {
  if (value == null) return 0;
  if (typeof value === "number") return Number.isFinite(value) ? roundMoney(value) : 0;
  if (typeof value === "object" && value !== null && "toNumber" in value) {
    const t = (value as { toNumber: () => number }).toNumber();
    return Number.isFinite(t) ? roundMoney(t) : 0;
  }
  const n = Number(value as string);
  return Number.isFinite(n) ? roundMoney(n) : 0;
}

export function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}
