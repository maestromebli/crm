import type {
  DealContractDraft,
  DealContractRecipientType,
  DealDocumentFormat,
  DealDocumentType,
  HandoffManifest,
} from "@/lib/deal-core/workspace-types";
import { CONTRACT_SUPPLY_ZRAZOK_HTML } from "@/lib/deals/contract-supply-zrazok-html";

export type DealDocumentTemplate = {
  key: string;
  title: string;
  documentType: DealDocumentType;
  format: DealDocumentFormat;
  description: string;
  defaultHtml: string;
  defaultVariables: Record<string, string>;
};

export const DEAL_DOCUMENT_TEMPLATES: DealDocumentTemplate[] = [
  {
    key: "contract_basic_html",
    title: "Договір (базовий, HTML)",
    documentType: "CONTRACT",
    format: "HTML",
    description: "Базовий шаблон договору для редагування в CRM.",
    defaultHtml:
      "<h2>ДОГОВІР №{{dealNumber}}</h2><p>Клієнт: {{clientName}}</p><p>Об'єкт: {{dealTitle}}</p><p>Сума: {{dealValue}} {{dealCurrency}}</p>",
    defaultVariables: {},
  },
  {
    key: "contract_basic_docx",
    title: "Договір (базовий, DOCX)",
    documentType: "CONTRACT",
    format: "DOCX",
    description: "Каркас DOCX (змінні заповнюються у CRM).",
    defaultHtml:
      "<h2>DOCX CONTRACT SKELETON</h2><p>Використайте експорт DOCX на наступному етапі.</p>",
    defaultVariables: {},
  },
  {
    key: "contract_enver_e52_diia_docx",
    title: "Договір E-52 (DOCX + Дія.Підпис)",
    documentType: "CONTRACT",
    format: "DOCX",
    description:
      "Шаблон на базі договору E-52 з полями для заповнення і подальшого підпису через Дія.Підпис.",
    defaultHtml:
      "<h2>Договір №{{contractNumber}}</h2><p>Дата: {{contractDate}}</p><p>Замовник: {{customerFullName}}</p><p>РНОКПП/ЄДРПОУ: {{customerTaxId}}</p><p>Адреса: {{customerAddress}}</p><p>Предмет: {{contractSubject}}</p><p>Сума: {{contractAmount}} грн</p><p>Термін виконання: {{executionTerm}}</p><p>Умови оплати: {{paymentTerms}}</p>",
    defaultVariables: {
      contractNumber: "",
      contractDate: "",
      customerFullName: "",
      customerTaxId: "",
      customerAddress: "",
      contractSubject: "",
      contractAmount: "",
      executionTerm: "",
      paymentTerms: "",
      contractorFullName: "",
      contractorTaxId: "",
      contractorAddress: "",
    },
  },
  {
    key: "contract_supply_goods_zrazok_html",
    title: "Договір поставки товару (зразок, HTML)",
    documentType: "CONTRACT",
    format: "HTML",
    description:
      "Текст на основі зразка договору поставки: реквізити, 70/30, додаток-специфікація. Змінні підставляються з замовлення.",
    defaultHtml: CONTRACT_SUPPLY_ZRAZOK_HTML,
    defaultVariables: {
      contractNumber: "",
      contractCity: "",
      contractDay: "",
      contractMonth: "",
      contractYear: "",
      contractDateShort: "",
      contractorFullName: "",
      contractorTaxId: "",
      contractorRequisitesBlock: "",
      contractorSignatory: "",
      customerPartyLabel: "",
      customerFullName: "",
      customerTaxId: "",
      customerAddress: "",
      customerRequisitesBlock: "",
      customerSignatory: "",
      contractAmount: "",
      contractAmountWords: "",
      objectAddress: "",
      advancePercent: "",
      advanceAmount: "",
      advanceAmountWords: "",
      remainderPercent: "",
      remainderAmount: "",
      remainderAmountWords: "",
      contractValidUntil: "",
    },
  },
  {
    key: "spec_basic_html",
    title: "Специфікація (базова, HTML)",
    documentType: "SPEC",
    format: "HTML",
    description: "Базовий шаблон специфікації.",
    defaultHtml:
      "<h2>СПЕЦИФІКАЦІЯ</h2><p>Проєкт: {{dealTitle}}</p><p>Замовник: {{clientName}}</p>",
    defaultVariables: {},
  },
  {
    key: "spec_basic_docx",
    title: "Специфікація (базова, DOCX)",
    documentType: "SPEC",
    format: "DOCX",
    description: "Каркас DOCX для специфікації.",
    defaultHtml:
      "<h2>DOCX SPEC SKELETON</h2><p>Експорт DOCX буде підключено окремим кроком.</p>",
    defaultVariables: {},
  },
];

export function parseRecipientType(v: unknown): DealContractRecipientType {
  return v === "CLIENT_COMPANY" ? "CLIENT_COMPANY" : "CLIENT_PERSON";
}

export function parseHandoffManifest(v: unknown): HandoffManifest {
  if (!v || typeof v !== "object" || Array.isArray(v)) {
    return {
      selectedAttachmentIds: [],
      selectedFileAssetIds: [],
      generatedDocumentIds: [],
    };
  }
  const o = v as Record<string, unknown>;
  const asStringArray = (x: unknown) =>
    Array.isArray(x)
      ? x.filter((i): i is string => typeof i === "string" && i.trim().length > 0)
      : [];
  return {
    selectedAttachmentIds: asStringArray(o.selectedAttachmentIds),
    selectedFileAssetIds: asStringArray(o.selectedFileAssetIds),
    generatedDocumentIds: asStringArray(o.generatedDocumentIds),
    ...(typeof o.notes === "string" && o.notes.trim()
      ? { notes: o.notes.trim().slice(0, 4000) }
      : {}),
  };
}

export function makeDefaultDraft(args: {
  template: DealDocumentTemplate;
  clientName: string;
  dealTitle: string;
  dealValue: number | null;
  dealCurrency: string | null;
  recipientType: DealContractRecipientType;
}): DealContractDraft {
  return {
    documentType: args.template.documentType,
    format: args.template.format,
    templateKey: args.template.key,
    recipientType: args.recipientType,
    variables: {
      clientName: args.clientName,
      dealTitle: args.dealTitle,
      dealValue:
        typeof args.dealValue === "number" ? String(args.dealValue) : "",
      dealCurrency: args.dealCurrency ?? "UAH",
      dealNumber: "",
      ...args.template.defaultVariables,
    },
    contentHtml: args.template.defaultHtml,
    contentJson: null,
  };
}

