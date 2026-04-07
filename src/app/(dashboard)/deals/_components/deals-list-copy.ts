import type { DealListViewId } from "../../../../features/deal-workspace/queries";

export type DealsListCopy = {
  title: string;
  description: string;
  emptyExtra?: string;
};

export const DEAL_LIST_COPY: Record<DealListViewId, DealsListCopy> = {
  all: {
    title: "Усі угоди",
    description:
      "Повний операційний список у вашій зоні видимості: пошук по воронці та клієнту, сортування, експорт CSV, збережені вигляди, інтелектуальний огляд ризиків і перехід у робоче місце угоди.",
  },
  pipeline: {
    title: "Дошка воронки",
    description:
      "Канбан за реальним порядком стадій у воронці (не алфавітно), таблиця з щільністю, фільтр менеджера, інтелектуальні підказки та CSV — зручний щоденний процес продажів.",
  },
  active: {
    title: "Активні проєкти",
    description: "Угоди зі статусом «Відкрита» — у роботі у відділу продажів.",
    emptyExtra: "Немає відкритих угод у вашій зоні видимості.",
  },
  waiting_measure: {
    title: "Очікують заміру",
    description: "Стадія «Замір» у воронці угод — підготовка до прорахунку та КП.",
    emptyExtra: "Немає угод на стадії заміру.",
  },
  proposal: {
    title: "КП надіслано",
    description: "Стадія «КП» — комерційна пропозиція в роботі або надіслана клієнту.",
    emptyExtra: "Немає угод на стадії КП.",
  },
  negotiation: {
    title: "Переговори",
    description: "Стадія «Договір» — узгодження умов і підписання.",
    emptyExtra: "Немає угод на стадії договору.",
  },
  won: {
    title: "Успішні угоди",
    description: "Закриті з результатом «Успіх» (статус угоди).",
    emptyExtra: "Поки немає виграних угод у списку.",
  },
  lost: {
    title: "Втрачені угоди",
    description: "Закриті з результатом «Втрата».",
    emptyExtra: "Немає втрачених угод у вибірці.",
  },
  archived: {
    title: "Архів",
    description: "Угоди на паузі (статус «На утриманні»).",
    emptyExtra: "Архів порожній.",
  },
};
