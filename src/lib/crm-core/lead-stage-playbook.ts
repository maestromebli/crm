import type { LeadStageKey } from "./lead-stage.types";

/** Продуктові визначення етапів (UA) — джерело для UI / навчання / AI. */
export type StagePlaybookEntry = {
  purposeUa: string;
  requiredFieldsUa: string[];
  exitConditionsUa: string[];
  recommendedCtaUa: string;
};

export const LEAD_STAGE_PLAYBOOK: Record<LeadStageKey, StagePlaybookEntry> = {
  NEW: {
    purposeUa: "Швидко встановити контакт і підтвердити запит.",
    requiredFieldsUa: ["Джерело", "Телефон або email", "Відповідальний"],
    exitConditionsUa: ["Перший дотик менеджера за SLA", "Контакт підтверджено"],
    recommendedCtaUa: "Зв’язатися з клієнтом",
  },
  CONTACT: {
    purposeUa: "Зібрати кваліфікацію та рішення: замір чи одразу розрахунок.",
    requiredFieldsUa: [
      "Суть запиту",
      "Тип меблів / об’єкт",
      "Рішення щодо заміру",
      "Бюджет (бажано)",
    ],
    exitConditionsUa: ["Запит зафіксовано", "Замір заплановано або перехід до смети"],
    recommendedCtaUa: "Запланувати замір або перейти до розрахунку",
  },
  MEASUREMENT: {
    purposeUa: "Зафіксувати об’єкт: розміри, фото, нотатки.",
    requiredFieldsUa: ["Подія заміру або виїзд", "Адреса / контекст", "Лист заміру або файли"],
    exitConditionsUa: ["Матеріал для прорахунку зібрано"],
    recommendedCtaUa: "Створити розрахунок",
  },
  CALCULATION: {
    purposeUa: "Версії смети, активна версія для КП.",
    requiredFieldsUa: ["Хоча б одна версія смети", "Активна версія обрана"],
    exitConditionsUa: ["Готова база для комерційної пропозиції"],
    recommendedCtaUa: "Створити КП з активної версії",
  },
  QUOTE_DRAFT: {
    purposeUa: "Підготувати КП на знімку смети.",
    requiredFieldsUa: ["КП прив’язане до активної смети"],
    exitConditionsUa: ["КП готове до відправки"],
    recommendedCtaUa: "Надіслати КП",
  },
  QUOTE_SENT: {
    purposeUa: "Супровід клієнта після відправки КП.",
    requiredFieldsUa: ["Статус діалогу", "Дата follow-up"],
    exitConditionsUa: ["Узгодження умов або коректна відмова"],
    recommendedCtaUa: "Запланувати follow-up",
  },
  APPROVED: {
    purposeUa: "Фіналізувати суму та перейти в угоду.",
    requiredFieldsUa: ["Погоджене КП", "Сума в сметі"],
    exitConditionsUa: ["Готовність до конверсії в угоду"],
    recommendedCtaUa: "Конвертувати в угоду",
  },
  CLIENT: {
    purposeUa: "Підтримка клієнта після узгодження умов.",
    requiredFieldsUa: ["Контакт", "Погоджені умови"],
    exitConditionsUa: ["Перехід до договору / контрольного заміру"],
    recommendedCtaUa: "Відкрити картку клієнта",
  },
  CONTROL_MEASUREMENT: {
    purposeUa: "Контрольний виїзд перед виробництвом.",
    requiredFieldsUa: ["Подія", "Адреса", "Нотатки після виїзду"],
    exitConditionsUa: ["Корекції передані в смету за потреби"],
    recommendedCtaUa: "Запланувати контрольний замір",
  },
  CONTRACT: {
    purposeUa: "Юридичне оформлення в угоді.",
    requiredFieldsUa: ["Погоджені комерційні умови"],
    exitConditionsUa: ["Договір у роботі в картці угоди"],
    recommendedCtaUa: "Перейти до договору в угоді",
  },
  DEAL: {
    purposeUa: "Операційна робота після конверсії.",
    requiredFieldsUa: [],
    exitConditionsUa: ["Угода ведеться в окремому робочому просторі"],
    recommendedCtaUa: "Відкрити угоду",
  },
  PRODUCTION_READY: {
    purposeUa: "Пакет для передачі у виробництво.",
    requiredFieldsUa: ["Погоджені умови", "Технічний пакет файлів"],
    exitConditionsUa: ["Handoff готовий"],
    recommendedCtaUa: "Підтвердити готовність до виробництва",
  },
  LOST: {
    purposeUa: "Закриття без угоди.",
    requiredFieldsUa: [],
    exitConditionsUa: [],
    recommendedCtaUa: "Архівувати причину",
  },
  ARCHIVED: {
    purposeUa: "Архів після конверсії або закриття.",
    requiredFieldsUa: [],
    exitConditionsUa: [],
    recommendedCtaUa: "Переглянути запис",
  },
  UNKNOWN: {
    purposeUa: "Уточнити відповідність стадії воронці.",
    requiredFieldsUa: ["Відповідальний", "Контакт"],
    exitConditionsUa: [],
    recommendedCtaUa: "Налаштувати стадію вручну",
  },
};
