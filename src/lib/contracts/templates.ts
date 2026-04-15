import { amountToWordsUk, formatCurrencyUAH, formatUADate, renderSpecificationRows } from "./formatters";

export type ContractTemplateModel = {
  contractNumber: string;
  contractDate: string;
  customerFullName: string;
  customerTaxId: string;
  customerPhone: string;
  customerEmail: string;
  objectAddress: string;
  deliveryAddress: string;
  totalAmount: number;
  advanceAmount: number;
  remainingAmount: number;
  productionLeadTimeDays: number;
  supplierName: string;
  supplierTaxId: string;
  supplierAddress: string;
  supplierBankDetails: string;
};

export const CONTRACT_VARIABLE_TEMPLATE = {
  contractNumber: "{{contractNumber}}",
  contractDate: "{{contractDate}}",
  customerFullName: "{{customerFullName}}",
  customerTaxId: "{{customerTaxId}}",
  customerPhone: "{{customerPhone}}",
  customerEmail: "{{customerEmail}}",
  objectAddress: "{{objectAddress}}",
  deliveryAddress: "{{deliveryAddress}}",
  totalAmount: "{{totalAmount}}",
  advanceAmount: "{{advanceAmount}}",
  remainingAmount: "{{remainingAmount}}",
  productionLeadTimeDays: "{{productionLeadTimeDays}}",
  supplierName: "{{supplierName}}",
  supplierTaxId: "{{supplierTaxId}}",
  supplierAddress: "{{supplierAddress}}",
  supplierBankDetails: "{{supplierBankDetails}}",
  specificationRows: "{{specificationRows}}",
};

export function renderContractTemplateHtml(model: ContractTemplateModel): string {
  return `
<h2>ДОГОВІР ПОСТАЧАННЯ ТОВАРУ № ${model.contractNumber}</h2>
<p>Дата: ${formatUADate(model.contractDate)}</p>
<p>Постачальник: ${model.supplierName}</p>
<p>Покупець: ${model.customerFullName}</p>
<h3>1. Предмет договору</h3>
<p>Постачальник передає, а Покупець приймає товар згідно Додатку №1.</p>
<h3>2. Якість, кількість та упаковка товару</h3>
<p>Відповідно до специфікації.</p>
<h3>3. Умови та строки поставки</h3>
<p>Адреса об'єкта: ${model.objectAddress}</p>
<p>Адреса поставки: ${model.deliveryAddress}</p>
<p>Строк поставки: ${model.productionLeadTimeDays} днів</p>
<h3>4. Порядок розрахунків</h3>
<p>Загальна вартість: ${formatCurrencyUAH(model.totalAmount)} (${amountToWordsUk(model.totalAmount)})</p>
<p>Аванс: ${formatCurrencyUAH(model.advanceAmount)}</p>
<p>Залишок: ${formatCurrencyUAH(model.remainingAmount)}</p>
<h3>5-13. Інші умови договору</h3>
<p>Обов'язки сторін, відповідальність, гарантія, вирішення спорів, форс-мажор, строк дії, зміни, припинення та прикінцеві положення — згідно шаблону ENVER.</p>
<h3>14. Реквізити сторін</h3>
<p>Постачальник: ${model.supplierName}, ІПН/ЄДРПОУ: ${model.supplierTaxId}, адреса: ${model.supplierAddress}</p>
<p>Банківські реквізити: ${model.supplierBankDetails}</p>
<p>Покупець: ${model.customerFullName}, ІПН: ${model.customerTaxId}, тел: ${model.customerPhone}, email: ${model.customerEmail}</p>
`;
}

export function renderSpecificationTemplateHtml(input: {
  contractNumber: string;
  rows: Array<{
    lineNumber: number;
    productName: string;
    unit: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
    notes?: string | null;
  }>;
  total: number;
}): string {
  return `
<h3>Додаток №1 до договору №${input.contractNumber}</h3>
<table border="1" cellspacing="0" cellpadding="4">
  <thead>
    <tr>
      <th>#</th><th>Найменування</th><th>Од.</th><th>К-сть</th><th>Ціна</th><th>Сума</th><th>Примітки</th>
    </tr>
  </thead>
  <tbody>
    ${renderSpecificationRows(input.rows)}
  </tbody>
</table>
<p>Разом: ${formatCurrencyUAH(input.total)} (${amountToWordsUk(input.total)})</p>
`;
}
