"use client";

import type { AttachmentCategory } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { LeadAttachmentListItem } from "../../features/leads/queries";
import { postFormData } from "../../lib/api/patch-json";
import { LEAD_CREATE_FILE_WARNINGS_KEY } from "../../lib/leads/lead-file-warnings-storage";
import { cn } from "../../lib/utils";
import { LeadFileIntelBadge } from "../../features/ai/components/LeadFileIntelBadge";

const CATEGORY_LABEL: Record<AttachmentCategory, string> = {
  OBJECT_PHOTO: "Фото об'єкта",
  MEASUREMENT_SHEET: "Лист заміру",
  BRIEF: "Бриф",
  REFERENCE: "Референс",
  CALCULATION: "Розрахунок",
  QUOTE_PDF: "КП (PDF)",
  CONTRACT: "Договір",
  INVOICE: "Рахунок",
  PAYMENT_CONFIRMATION: "Підтвердження оплати",
  DRAWING: "Креслення",
  SPEC: "Специфікація",
  TECH_CARD: "Техкарта",
  INSTALL_SCHEME: "Схема монтажу",
  ACCEPTANCE_ACT: "Акт приймання",
  RESULT_PHOTO: "Фото результату",
  OTHER: "Інше",
};

const UPLOAD_CATEGORIES: { value: AttachmentCategory; label: string }[] = [
  { value: "MEASUREMENT_SHEET", label: CATEGORY_LABEL.MEASUREMENT_SHEET },
  { value: "DRAWING", label: CATEGORY_LABEL.DRAWING },
  { value: "CALCULATION", label: CATEGORY_LABEL.CALCULATION },
  { value: "QUOTE_PDF", label: CATEGORY_LABEL.QUOTE_PDF },
  { value: "OBJECT_PHOTO", label: CATEGORY_LABEL.OBJECT_PHOTO },
  { value: "OTHER", label: CATEGORY_LABEL.OTHER },
];

type Props = {
  leadId: string;
  attachments: LeadAttachmentListItem[];
  canUpload: boolean;
};

export function LeadFilesTabClient({ leadId, attachments, canUpload }: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [category, setCategory] = useState<AttachmentCategory>("OTHER");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(LEAD_CREATE_FILE_WARNINGS_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as {
        leadId?: string;
        messages?: string[];
      };
      if (parsed.leadId === leadId && parsed.messages?.length) {
        setBanner(
          `Частина файлів не додалась: ${parsed.messages.join("; ")}. Можна спробувати ще раз тут.`,
        );
      }
      sessionStorage.removeItem(LEAD_CREATE_FILE_WARNINGS_KEY);
    } catch {
      sessionStorage.removeItem(LEAD_CREATE_FILE_WARNINGS_KEY);
    }
  }, [leadId]);

  const inputCls =
    "mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm";

  return (
    <section className="rounded-2xl border border-slate-200 bg-[var(--enver-card)] p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-[var(--enver-text)]">Файли</h2>
      <p className="mt-1 text-xs text-slate-600">
        Файли зберігаються на сервері та привʼязані до ліда (у т.ч. при конвертації в
        угоду).
      </p>

      {banner ? (
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {banner}
        </p>
      ) : null}
      {err ? (
        <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-800">
          {err}
        </p>
      ) : null}

      {canUpload ? (
        <div className="mt-4 flex flex-col gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:items-end">
          <label className="block flex-1 text-[11px]">
            <span className="text-slate-500">Категорія</span>
            <select
              value={category}
              onChange={(e) =>
                setCategory(e.target.value as AttachmentCategory)
              }
              className={inputCls}
            >
              {UPLOAD_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <input
            ref={inputRef}
            type="file"
            multiple
            className="hidden"
            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip"
            onChange={() => void (async () => {
              const el = inputRef.current;
              const list = el?.files;
              if (!list?.length) return;
              setErr(null);
              setBusy(true);
              try {
                for (let i = 0; i < list.length; i++) {
                  const file = list.item(i);
                  if (!file) continue;
                  const fd = new FormData();
                  fd.append("file", file);
                  fd.append("category", category);
                  const j = await postFormData<{
                    error?: string;
                  }>(`/api/leads/${leadId}/attachments`, fd);
                }
                el.value = "";
                router.refresh();
              } catch (e) {
                setErr(e instanceof Error ? e.message : "Помилка завантаження");
              } finally {
                setBusy(false);
              }
            })()}
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            className={cn(
              "rounded-lg border border-slate-800 bg-slate-900 px-4 py-2 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50",
            )}
          >
            {busy ? "Завантаження…" : "Додати файли"}
          </button>
        </div>
      ) : null}

      {attachments.length === 0 ? (
        <p className="mt-4 text-xs text-slate-500">Поки немає вкладень.</p>
      ) : (
        <ul className="mt-4 space-y-2 text-xs">
          {attachments.map((a) => (
            <li
              key={a.id}
              className="flex flex-col gap-2 rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between"
            >
              <div className="min-w-0 flex-1">
                <a
                  href={a.fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-[var(--enver-text)] underline-offset-2 hover:underline"
                >
                  {a.fileName}
                </a>
                <div className="mt-1">
                  <LeadFileIntelBadge
                    item={a}
                    canUpload={canUpload}
                    onIntelUpdated={() => router.refresh()}
                  />
                </div>
              </div>
              <span className="shrink-0 text-slate-500">
                {CATEGORY_LABEL[a.category] ?? a.category}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
