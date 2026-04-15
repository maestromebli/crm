import { escapeHtml, formatAmountWordsUkr, formatCurrencyUah, formatCustomerRequisites, formatDateUk } from "../document-helpers";

export interface ContractTemplateInput {
  contractNumber: string;
  contractDate: Date | string;
  customerFullName: string;
  customerTaxId?: string | null;
  customerPassportData?: string | null;
  customerPhone?: string | null;
  customerEmail?: string | null;
  objectAddress?: string | null;
  deliveryAddress?: string | null;
  totalAmount: number;
  advanceAmount: number;
  remainingAmount: number;
  productionLeadTimeDays?: number | null;
  installationLeadTime?: string | null;
  paymentTerms?: string | null;
  warrantyMonths?: number | null;
  managerComment?: string | null;
  specialConditions?: string | null;
  supplierSignerName?: string | null;
  supplierSignerBasis?: string | null;
}

export function renderContractHtml(input: ContractTemplateInput): string {
  const contractDate = formatDateUk(input.contractDate);
  const totalAmount = formatCurrencyUah(input.totalAmount);
  const advanceAmount = formatCurrencyUah(input.advanceAmount);
  const remainingAmount = formatCurrencyUah(input.remainingAmount);
  const requisites = formatCustomerRequisites({
    fullName: input.customerFullName,
    taxId: input.customerTaxId,
    passportData: input.customerPassportData,
    phone: input.customerPhone,
    email: input.customerEmail,
    address: input.deliveryAddress ?? input.objectAddress
  });

  return `<!doctype html>
<html lang="uk">
<head>
  <meta charset="utf-8" />
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.45; color: #0f172a; margin: 28px; }
    h1, h2 { text-align: center; margin: 0 0 12px 0; }
    h2 { margin-top: 18px; font-size: 18px; }
    p { margin: 6px 0; }
    .muted { color: #475569; font-size: 13px; }
    .section { margin-top: 14px; }
    .signatures { margin-top: 26px; display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
  </style>
</head>
<body>
  <h1>ДОГОВІР ПОСТАЧАННЯ ТОВАРУ № ${escapeHtml(input.contractNumber)}</h1>
  <p class="muted">Дата укладання: ${escapeHtml(contractDate)}</p>
  <p>Постачальник: ФОП Мамедов Енвер Микаилович, надалі "Постачальник".</p>
  <p>Покупець: ${escapeHtml(input.customerFullName)}, надалі "Покупець".</p>

  <div class="section"><h2>1. Предмет договору</h2><p>Постачальник зобов'язується поставити товар згідно Додатку №1 "Специфікація", а Покупець — прийняти та оплатити товар.</p></div>
  <div class="section"><h2>2. Якість, кількість та упаковка товару</h2><p>Якість та кількість відповідають специфікації. Упаковка забезпечує цілісність товару під час транспортування.</p></div>
  <div class="section"><h2>3. Умови та строки поставки</h2><p>Адреса об'єкта: ${escapeHtml(input.objectAddress ?? "-")}.</p><p>Адреса доставки: ${escapeHtml(input.deliveryAddress ?? "-")}.</p><p>Строк виготовлення: ${input.productionLeadTimeDays ?? "-"} календарних днів. Монтаж: ${escapeHtml(input.installationLeadTime ?? "-")}.</p></div>
  <div class="section"><h2>4. Порядок розрахунків</h2><p>Загальна сума: ${totalAmount} (${formatAmountWordsUkr(input.totalAmount)}).</p><p>Аванс: ${advanceAmount}. Залишок: ${remainingAmount}.</p><p>Умови оплати: ${escapeHtml(input.paymentTerms ?? "-")}.</p></div>
  <div class="section"><h2>5. Обов'язки сторін, претензії</h2><p>Сторони виконують обов'язки відповідно до чинного законодавства України та умов цього договору.</p></div>
  <div class="section"><h2>6. Відповідальність</h2><p>У разі порушення умов договору сторони несуть відповідальність згідно законодавства України.</p></div>
  <div class="section"><h2>7. Гарантія</h2><p>Гарантійний строк: ${input.warrantyMonths ?? "-"} місяців від дати передачі товару.</p></div>
  <div class="section"><h2>8. Вирішення спорів</h2><p>Спори вирішуються шляхом переговорів, а у разі недосягнення згоди — у судовому порядку.</p></div>
  <div class="section"><h2>9. Форс-мажор</h2><p>Сторони звільняються від відповідальності на час дії обставин непереборної сили.</p></div>
  <div class="section"><h2>10. Строк дії договору</h2><p>Договір діє до повного виконання зобов'язань сторонами.</p></div>
  <div class="section"><h2>11. Внесення змін</h2><p>Зміни до договору дійсні лише у письмовій формі за згодою сторін.</p></div>
  <div class="section"><h2>12. Припинення договору та інші умови</h2><p>Договір може бути припинений за взаємною згодою сторін або з інших підстав, передбачених законом.</p></div>
  <div class="section"><h2>13. Прикінцеві положення</h2><p>Додаток №1 "Специфікація" є невід'ємною частиною цього договору.</p></div>
  <div class="section"><h2>14. Реквізити сторін</h2><p><strong>Постачальник:</strong> ФОП Мамедов Енвер Микаилович</p><p><strong>Покупець:</strong><br/>${requisites}</p></div>

  <div class="section"><p>Спеціальні умови: ${escapeHtml(input.specialConditions ?? "-")}</p><p>Коментар менеджера: ${escapeHtml(input.managerComment ?? "-")}</p></div>

  <div class="signatures">
    <div><p>Постачальник: ${escapeHtml(input.supplierSignerName ?? "________________")}</p><p>Підстава: ${escapeHtml(input.supplierSignerBasis ?? "-")}</p></div>
    <div><p>Покупець: ${escapeHtml(input.customerFullName)}</p><p>Підпис: ____________________</p></div>
  </div>
</body>
</html>`;
}
