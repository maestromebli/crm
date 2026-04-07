import type { QuoteDocument, QuoteItem } from "./quote-types";

/** Приклад згрупованого КП для тестів / сторібуку */
export const MOCK_QUOTE_ITEMS: QuoteItem[] = [
  {
    id: "qi_mock_1",
    sortOrder: 0,
    title: "Передпокій (шафа, дзеркало)",
    quantity: 1,
    totalPrice: 51205,
    descriptionLines: [
      "ДСП лам. Kronospan 0164 PD Антрацит NEW",
      "ДВП «Біле»",
      "Петлі «Блюм» без доводки",
      "Направляючі телескопічні повного висуву «Мюллер»",
      "Дзеркало срібло в чорній рамі / без підсвітки",
      "Гачки чорні",
      "Без ручок",
    ],
    images: [
      {
        id: "img_1",
        url: "https://placehold.co/400x300/e2e8f0/1e293b?text=Передпокій",
        sortOrder: 0,
      },
    ],
  },
  {
    id: "qi_mock_2",
    sortOrder: 1,
    title: "Кухня, без стільниці",
    quantity: 1,
    totalPrice: 134700,
    descriptionLines: [
      "МДФ фарбований RAL 9005",
      "Петлі Blum з доводкою",
      "Тандеми повного висуву Blum",
      "Ручка Gola чорна",
      "Підсвітка верхніх тумб",
    ],
    images: [],
  },
];

export const MOCK_QUOTE_DOCUMENT: QuoteDocument = {
  id: "doc_mock",
  title: "Кухня + передпокій",
  version: "3",
  estimateVersion: "12",
  createdAt: new Date().toISOString(),
  projectName: "ЖК Приклад",
  items: MOCK_QUOTE_ITEMS,
  footerNotes: [],
  totalAmount: MOCK_QUOTE_ITEMS.reduce((s, i) => s + i.totalPrice, 0),
};
