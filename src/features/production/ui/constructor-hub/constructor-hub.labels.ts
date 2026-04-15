import type {
  ConstructorAIAlertLevel,
  ConstructorFileCategory,
  ConstructorHubStatus,
  ConstructorQuestionCategory,
  ConstructorQuestionStatus,
  ConstructorQuestionTarget,
  ConstructorVersionApprovalStatus,
  ConstructorVersionType,
} from "./constructor-hub.types";

export const CONSTRUCTOR_STATUS_LABEL: Record<ConstructorHubStatus, string> = {
  UNASSIGNED: "Не назначен",
  ASSIGNED: "Назначен",
  REVIEWING: "Изучает",
  HAS_QUESTIONS: "Есть вопросы",
  IN_PROGRESS: "В работе",
  DRAFT_UPLOADED: "Черновик загружен",
  UNDER_REVIEW: "На проверке",
  NEEDS_REWORK: "На доработке",
  APPROVED: "Утверждено",
  HANDED_OFF: "Передано в производство",
};

export const CONSTRUCTOR_STATUS_CLASS: Record<ConstructorHubStatus, string> = {
  UNASSIGNED: "bg-slate-100 text-slate-700 border-slate-200",
  ASSIGNED: "bg-sky-100 text-sky-900 border-sky-200",
  REVIEWING: "bg-indigo-100 text-indigo-900 border-indigo-200",
  HAS_QUESTIONS: "bg-amber-100 text-amber-900 border-amber-200",
  IN_PROGRESS: "bg-cyan-100 text-cyan-900 border-cyan-200",
  DRAFT_UPLOADED: "bg-violet-100 text-violet-900 border-violet-200",
  UNDER_REVIEW: "bg-fuchsia-100 text-fuchsia-900 border-fuchsia-200",
  NEEDS_REWORK: "bg-rose-100 text-rose-900 border-rose-200",
  APPROVED: "bg-emerald-100 text-emerald-900 border-emerald-200",
  HANDED_OFF: "bg-teal-100 text-teal-900 border-teal-200",
};

export const QUESTION_CATEGORY_LABEL: Record<ConstructorQuestionCategory, string> = {
  SIZES: "Размеры",
  MATERIALS: "Материалы",
  TECH: "Техника",
  INSTALLATION: "Монтаж",
  DESIGN: "Дизайн",
  PRODUCTION: "Производство",
};

export const QUESTION_TARGET_LABEL: Record<ConstructorQuestionTarget, string> = {
  MANAGER: "Менеджер",
  MEASURER: "Замерщик",
  HEAD_OF_PRODUCTION: "Нач. производства",
  CLIENT: "Клиент",
};

export const QUESTION_STATUS_LABEL: Record<ConstructorQuestionStatus, string> = {
  OPEN: "Открыт",
  IN_PROGRESS: "В работе",
  CLOSED: "Закрыт",
};

export const FILE_CATEGORY_LABEL: Record<ConstructorFileCategory, string> = {
  CLIENT_PROJECT: "Проект клиента",
  OBJECT_PHOTO: "Фото объекта",
  MEASUREMENTS: "Замеры",
  VIDEO: "Видео",
  REFERENCES: "Референсы",
  PROPOSAL_APPROVED: "КП / согласованная версия",
  APPROVED_MATERIALS: "Согласованные материалы",
  REVISION_COMMENTS: "Комментарии по правкам",
  OLD_VERSIONS: "Старые версии",
  FINAL_FOR_PRODUCTION: "Финальные файлы для производства",
};

export const VERSION_TYPE_LABEL: Record<ConstructorVersionType, string> = {
  DRAFT: "Черновик",
  REVIEW: "Проверка",
  FINAL: "Финал",
};

export const VERSION_STATUS_LABEL: Record<ConstructorVersionApprovalStatus, string> = {
  PENDING: "Ожидает",
  APPROVED: "Утверждено",
  RETURNED: "Возврат",
  REJECTED: "Отклонено",
};

export const AI_LEVEL_CLASS: Record<ConstructorAIAlertLevel, string> = {
  INFO: "border-sky-200 bg-sky-50 text-sky-900",
  WARNING: "border-amber-200 bg-amber-50 text-amber-900",
  CRITICAL: "border-rose-200 bg-rose-50 text-rose-900",
};
