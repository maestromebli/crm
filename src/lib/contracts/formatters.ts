export function formatUADate(input: Date | string | null | undefined): string {
  if (!input) return "";
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("uk-UA", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export function formatCurrencyUAH(amount: number): string {
  return new Intl.NumberFormat("uk-UA", {
    style: "currency",
    currency: "UAH",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0);
}

export function amountToWordsUk(amount: number): string {
  const rounded = Math.round((Number.isFinite(amount) ? amount : 0) * 100) / 100;
  return `${rounded.toFixed(2)} гривень`;
}

export function formatPartyDetails(input: {
  fullName: string;
  taxId?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
}): string {
  return [
    `ПІБ: ${input.fullName}`,
    input.taxId ? `ІПН/ЄДРПОУ: ${input.taxId}` : null,
    input.phone ? `Телефон: ${input.phone}` : null,
    input.email ? `Email: ${input.email}` : null,
    input.address ? `Адреса: ${input.address}` : null,
  ]
    .filter(Boolean)
    .join(", ");
}

export function renderSpecificationRows(
  rows: Array<{
    lineNumber: number;
    productName: string;
    unit: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
    notes?: string | null;
  }>,
): string {
  return rows
    .map(
      (row) =>
        `<tr>
<td>${row.lineNumber}</td>
<td>${row.productName}</td>
<td>${row.unit}</td>
<td>${row.quantity}</td>
<td>${formatCurrencyUAH(row.unitPrice)}</td>
<td>${formatCurrencyUAH(row.lineTotal)}</td>
<td>${row.notes ?? ""}</td>
</tr>`,
    )
    .join("\n");
}
