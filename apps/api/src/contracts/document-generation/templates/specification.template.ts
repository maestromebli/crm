import { escapeHtml, formatAmountWordsUkr, formatCurrencyUah } from "../document-helpers";

export interface SpecificationTemplateLine {
  lineNumber: number;
  productName: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  notes?: string | null;
}

export interface SpecificationTemplateInput {
  contractNumber: string;
  lines: SpecificationTemplateLine[];
  subtotal: number;
  total: number;
  currency: string;
}

export function renderSpecificationHtml(input: SpecificationTemplateInput): string {
  const rows = input.lines
    .map((line) => {
      return `<tr>
        <td>${line.lineNumber}</td>
        <td>${escapeHtml(line.productName)}</td>
        <td>${escapeHtml(line.unit)}</td>
        <td>${line.quantity}</td>
        <td>${formatCurrencyUah(line.unitPrice)}</td>
        <td>${formatCurrencyUah(line.lineTotal)}</td>
        <td>${escapeHtml(line.notes ?? "")}</td>
      </tr>`;
    })
    .join("");

  return `<!doctype html>
<html lang="uk">
<head>
  <meta charset="utf-8" />
  <style>
    body { font-family: Arial, sans-serif; margin: 24px; color: #0f172a; }
    h1 { text-align: center; margin-bottom: 4px; }
    p { margin: 2px 0; }
    table { width: 100%; border-collapse: collapse; margin-top: 14px; }
    th, td { border: 1px solid #94a3b8; padding: 6px 8px; font-size: 12px; }
    th { background: #e2e8f0; text-align: left; }
    .totals { margin-top: 16px; font-size: 14px; }
  </style>
</head>
<body>
  <h1>Додаток №1 — Специфікація</h1>
  <p>До договору поставки № ${escapeHtml(input.contractNumber)}</p>
  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Найменування</th>
        <th>Од.</th>
        <th>К-сть</th>
        <th>Ціна</th>
        <th>Сума</th>
        <th>Примітки</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="totals">
    <p>Підсумок: ${formatCurrencyUah(input.subtotal)}</p>
    <p>Разом: ${formatCurrencyUah(input.total)} (${formatAmountWordsUkr(input.total)})</p>
  </div>
</body>
</html>`;
}
