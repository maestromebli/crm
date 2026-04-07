import type { AttachmentCategory } from "@prisma/client";
import type { RefObject } from "react";
import { cn } from "../../../lib/utils";

const FILE_CATEGORY_OPTIONS: { value: AttachmentCategory; label: string }[] = [
  { value: "MEASUREMENT_SHEET", label: "Лист заміру" },
  { value: "DRAWING", label: "Креслення" },
  { value: "CALCULATION", label: "Розрахунок" },
  { value: "QUOTE_PDF", label: "КП (PDF)" },
  { value: "OBJECT_PHOTO", label: "Фото об'єкта" },
  { value: "OTHER", label: "Інше" },
];

type ExpandedLeadFormProps = {
  inputClass: string;
  email: string;
  onEmailChange: (v: string) => void;
  city: string;
  onCityChange: (v: string) => void;
  title: string;
  onTitleChange: (v: string) => void;
  objectType: string;
  onObjectTypeChange: (v: string) => void;
  budget: string;
  onBudgetChange: (v: string) => void;
  canUploadFiles: boolean;
  fileCategory: AttachmentCategory;
  onFileCategoryChange: (v: AttachmentCategory) => void;
  fileInputRef: RefObject<HTMLInputElement | null>;
  pendingFilesCount: number;
  onFilesSelected: (files: File[]) => void;
};

export function ExpandedLeadForm({
  inputClass,
  email,
  onEmailChange,
  city,
  onCityChange,
  title,
  onTitleChange,
  objectType,
  onObjectTypeChange,
  budget,
  onBudgetChange,
  canUploadFiles,
  fileCategory,
  onFileCategoryChange,
  fileInputRef,
  pendingFilesCount,
  onFilesSelected,
}: ExpandedLeadFormProps) {
  return (
    <div className="space-y-2 rounded-xl border border-slate-200 bg-[var(--enver-card)] px-3 py-2.5">
      <label className="block space-y-0.5">
        <span className="text-[11px] text-slate-600">Email</span>
        <input
          type="email"
          className={inputClass}
          value={email}
          onChange={(e) => onEmailChange(e.target.value)}
        />
      </label>
      <label className="block space-y-0.5">
        <span className="text-[11px] text-slate-600">Місто</span>
        <input
          className={inputClass}
          value={city}
          onChange={(e) => onCityChange(e.target.value)}
        />
      </label>
      <label className="block space-y-0.5">
        <span className="text-[11px] text-slate-600">Назва ліда</span>
        <input
          className={inputClass}
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
        />
      </label>
      <label className="block space-y-0.5">
        <span className="text-[11px] text-slate-600">Тип меблів / обʼєкта</span>
        <input
          className={inputClass}
          value={objectType}
          onChange={(e) => onObjectTypeChange(e.target.value)}
        />
      </label>
      <label className="block space-y-0.5">
        <span className="text-[11px] text-slate-600">Бюджет</span>
        <input
          className={inputClass}
          value={budget}
          onChange={(e) => onBudgetChange(e.target.value)}
        />
      </label>
      {canUploadFiles ? (
        <>
          <label className="block space-y-0.5">
            <span className="text-[11px] font-medium text-slate-700">
              Категорія файлів
            </span>
            <select
              className={inputClass}
              value={fileCategory}
              onChange={(e) =>
                onFileCategoryChange(e.target.value as AttachmentCategory)
              }
            >
              {FILE_CATEGORY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip"
            onChange={(e) => {
              const list = e.target.files;
              if (!list?.length) {
                onFilesSelected([]);
                return;
              }
              onFilesSelected(Array.from(list));
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full rounded-md border border-dashed border-slate-300 bg-slate-50/80 px-2 py-2 text-left text-[11px] text-slate-600"
          >
            {pendingFilesCount
              ? `Файлів: ${pendingFilesCount}`
              : "Додати файли"}
          </button>
        </>
      ) : null}
    </div>
  );
}
