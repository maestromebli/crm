const ukMonths = [
  "січня",
  "лютого",
  "березня",
  "квітня",
  "травня",
  "червня",
  "липня",
  "серпня",
  "вересня",
  "жовтня",
  "листопада",
  "грудня"
];

export function formatDateUk(dateValue: Date | string): string {
  const date = typeof dateValue === "string" ? new Date(dateValue) : dateValue;
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return `${date.getDate()} ${ukMonths[date.getMonth()]} ${date.getFullYear()} р.`;
}

export function formatCurrencyUah(amount: number): string {
  return new Intl.NumberFormat("uk-UA", {
    style: "currency",
    currency: "UAH",
    maximumFractionDigits: 2
  }).format(amount);
}

export function formatAmountWordsUkr(amount: number): string {
  const rounded = Math.round(amount * 100) / 100;
  return `${rounded.toFixed(2)} гривень`;
}

export function formatCustomerRequisites(input: {
  fullName: string;
  taxId?: string | null;
  passportData?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
}): string {
  return [
    `ПІБ: ${input.fullName}`,
    input.taxId ? `ІПН: ${input.taxId}` : null,
    input.passportData ? `Паспорт: ${input.passportData}` : null,
    input.phone ? `Телефон: ${input.phone}` : null,
    input.email ? `Електронна пошта: ${input.email}` : null,
    input.address ? `Адреса: ${input.address}` : null
  ]
    .filter(Boolean)
    .join("<br/>");
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
