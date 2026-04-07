/**
 * Модель комерційної пропозиції (КП): груповані позиції (виріб / зона / приміщення),
 * а не окремі рядки матеріалів.
 */

export type QuoteImage = {
  id: string;
  url: string;
  alt?: string;
  sortOrder: number;
};

export type QuoteItem = {
  id: string;
  sortOrder: number;
  /** Назва виробу / зони / приміщення */
  title: string;
  quantity: number;
  /** Ціна за одиницю (якщо задано разом із quantity) */
  unitPrice?: number;
  /** Вартість рядка (qty × unitPrice або фіксована сума за позицію) */
  totalPrice: number;
  /** Рядки опису матеріалів/комплектуючих (без окремих рядків таблиці) */
  descriptionLines: string[];
  images: QuoteImage[];
  notes?: string;
};

export type QuoteDocument = {
  id: string;
  title: string;
  version: string;
  estimateVersion?: string;
  createdAt: string;
  clientName?: string;
  projectName?: string;
  items: QuoteItem[];
  footerNotes: string[];
  totalAmount: number;
};

/** Модель для друку / HTML / PDF */
export type QuotePrintRow = {
  no: number;
  title: string;
  quantity: number;
  lineTotal: number;
  descriptionLines: string[];
  imageUrls: string[];
};

export type QuotePrintModel = {
  docTitle: string;
  objectLine: string;
  proposalVersion: number;
  estimateVersion: number | null;
  issuedAtLabel: string;
  issuedAtShort: string;
  currencyLabel: string;
  rows: QuotePrintRow[];
  totals: {
    discountAmount: number | null;
    deliveryCost: number | null;
    installationCost: number | null;
    total: number | null;
  };
  summary: string | null;
};
