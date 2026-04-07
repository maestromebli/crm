export type FormMode = "create" | "edit" | "quick";

export type FormSection = {
  id: string;
  label: string;
  description?: string;
  requiredFields?: string[];
  optionalFields?: string[];
  roleVisibility?: Array<"director" | "head" | "sales">;
};

export type EntityFormConfig = {
  name: string;
  mode: FormMode;
  layout: "modal" | "sheet" | "page";
  sections: FormSection[];
  linkedEntities?: string[];
  fileUpload?: boolean;
  checklist?: boolean;
  actions: ("save" | "save_close" | "save_next")[];
};

export type FormConfigMap = Record<string, EntityFormConfig>;

export const FORM_CONFIGS: FormConfigMap = {
  lead: {
    name: "Форма ліда",
    mode: "create",
    layout: "sheet",
    linkedEntities: ["contact", "deal"],
    fileUpload: true,
    checklist: false,
    actions: ["save", "save_close"],
    sections: [
      {
        id: "basic",
        label: "Основне",
        requiredFields: ["Імʼя", "Телефон"],
        optionalFields: ["Ел. пошта", "Місто"],
      },
      {
        id: "source",
        label: "Джерело",
        requiredFields: ["Джерело"],
        optionalFields: ["Кампанія", "UTM"],
      },
      {
        id: "request",
        label: "Запит",
        requiredFields: [],
        optionalFields: ["Тип обʼєкта", "Бюджет", "Коментар"],
      },
      {
        id: "assignment",
        label: "Призначення",
        requiredFields: [],
        optionalFields: ["Відповідальний", "Дата наступної дії"],
      },
    ],
  },
  deal: {
    name: "Форма угоди",
    mode: "create",
    layout: "sheet",
    linkedEntities: ["lead", "contact"],
    fileUpload: true,
    checklist: false,
    actions: ["save", "save_close", "save_next"],
    sections: [
      {
        id: "overview",
        label: "Огляд угоди",
        requiredFields: ["Назва", "Воронка", "Стадія"],
        optionalFields: ["Ймовірність"],
      },
      {
        id: "client",
        label: "Клієнт / контакти",
        requiredFields: ["Контакт"],
        optionalFields: ["Додаткові контакти"],
      },
      {
        id: "budget",
        label: "Бюджет / проєкт",
        requiredFields: [],
        optionalFields: ["Бюджет", "Валюта", "Тип проєкту"],
      },
      {
        id: "dates",
        label: "Дати",
        requiredFields: [],
        optionalFields: ["Очікуване закриття", "Дата заміру"],
      },
      {
        id: "links",
        label: "Повʼязані записи",
        requiredFields: [],
        optionalFields: ["ID ліда"],
      },
    ],
  },
  handoff: {
    name: "Форма передачі",
    mode: "create",
    layout: "page",
    linkedEntities: ["deal", "production"],
    fileUpload: true,
    checklist: true,
    actions: ["save", "save_close"],
    sections: [
      {
        id: "deal",
        label: "Угода",
        requiredFields: ["ID угоди"],
        optionalFields: ["Імʼя клієнта"],
      },
      {
        id: "summary",
        label: "Підсумок передачі",
        requiredFields: [],
        optionalFields: ["Обсяг", "Нотатки"],
      },
      {
        id: "files",
        label: "Обовʼязкові файли",
        requiredFields: [],
        optionalFields: ["Файли"],
      },
      {
        id: "checklist",
        label: "Чек-лист",
        requiredFields: [],
        optionalFields: ["Пункти чек-листа"],
      },
      {
        id: "responsible",
        label: "Відповідальні ролі",
        requiredFields: ["Відповідальний за виробництво"],
        optionalFields: ["Монтажна бригада"],
      },
    ],
  },
};

export type CoreStageFormTemplate = {
  stage:
    | "qualification"
    | "measurement"
    | "proposal"
    | "contract"
    | "payment"
    | "handoff"
    | "production";
  title: string;
  sections: FormSection[];
};

export const DEAL_CORE_STAGE_FORMS: Record<
  CoreStageFormTemplate["stage"],
  CoreStageFormTemplate
> = {
  qualification: {
    stage: "qualification",
    title: "Шаблон етапу кваліфікації",
    sections: [
      {
        id: "client-need",
        label: "Потреба клієнта",
        requiredFields: ["Запит клієнта", "Тип обʼєкта"],
        optionalFields: ["Бюджет", "Термін", "Примітки"],
      },
      {
        id: "responsibility",
        label: "Відповідальність",
        requiredFields: ["Відповідальний менеджер"],
        optionalFields: ["Наступний крок"],
      },
    ],
  },
  measurement: {
    stage: "measurement",
    title: "Шаблон етапу заміру",
    sections: [
      {
        id: "facts",
        label: "Результати заміру",
        requiredFields: ["Підтвердження заміру"],
        optionalFields: ["Ключові розміри", "Ризики приміщення"],
      },
      {
        id: "files",
        label: "Документи",
        requiredFields: ["Лист заміру або креслення"],
        optionalFields: ["Фото обʼєкта"],
      },
    ],
  },
  proposal: {
    stage: "proposal",
    title: "Шаблон етапу КП",
    sections: [
      {
        id: "estimate",
        label: "Смета/КП",
        requiredFields: ["Активна смета або версія КП"],
        optionalFields: ["Коментар для клієнта"],
      },
      {
        id: "sending",
        label: "Відправка",
        requiredFields: ["Позначка КП надіслано"],
        optionalFields: ["Дата фоллоу-апу"],
      },
    ],
  },
  contract: {
    stage: "contract",
    title: "Шаблон етапу договору",
    sections: [
      {
        id: "status",
        label: "Статус договору",
        requiredFields: ["Поточний статус договору"],
        optionalFields: ["Версія", "Коментар"],
      },
      {
        id: "approval",
        label: "Погодження",
        requiredFields: [],
        optionalFields: ["Внутрішнє погодження", "Підпис клієнта"],
        roleVisibility: ["director", "head"],
      },
    ],
  },
  payment: {
    stage: "payment",
    title: "Шаблон етапу оплати",
    sections: [
      {
        id: "milestones",
        label: "Віхи оплат",
        requiredFields: ["Щонайменше одна підтверджена віха"],
        optionalFields: ["Планові суми", "Примітки"],
      },
    ],
  },
  handoff: {
    stage: "handoff",
    title: "Шаблон етапу передачі",
    sections: [
      {
        id: "package",
        label: "Пакет передачі",
        requiredFields: ["Пакет передачі зібрано"],
        optionalFields: ["Нотатки передачі"],
      },
      {
        id: "acceptance",
        label: "Прийняття",
        requiredFields: ["Статус handoff"],
        optionalFields: ["Причина відхилення"],
        roleVisibility: ["director", "head"],
      },
    ],
  },
  production: {
    stage: "production",
    title: "Шаблон етапу виробництва",
    sections: [
      {
        id: "launch",
        label: "Запуск",
        requiredFields: ["Handoff = ACCEPTED", "Readiness = READY"],
        optionalFields: ["Дата запуску", "Коментар запуску"],
        roleVisibility: ["director", "head"],
      },
      {
        id: "execution",
        label: "Контроль виконання",
        requiredFields: [],
        optionalFields: ["Статус черги", "Блокери"],
      },
    ],
  },
};
