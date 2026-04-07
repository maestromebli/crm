/** Формат суми в гривні для таблиць і карток (uk-UA). */
export function formatMoneyUa(value: number, fractionDigits: 0 | 2 = 0): string {
  return value.toLocaleString("uk-UA", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}
