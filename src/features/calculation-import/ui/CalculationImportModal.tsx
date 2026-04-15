"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useRef, useState } from "react";
import { postFormData, postJson } from "@/lib/api/patch-json";
import type { ImportedWorkbook } from "../types/calculationImport.types";
import { CalculationImportPreview } from "./CalculationImportPreview";

type PreviewResponse = {
  ok: boolean;
  workbook: ImportedWorkbook;
  lineCount: number;
};

type ApplyResponse = {
  ok: boolean;
  importedRows: number;
  estimate?: {
    id: string;
    version: number;
    totalPrice: number | null;
  };
};

const btnPrimary =
  "rounded-lg border border-blue-700 bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50";
const btnGhost =
  "rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50";

function getDraftStorageKey(entity: { type: "lead" | "deal"; id: string }) {
  return `calc-import-draft:${entity.type}:${entity.id}`;
}

export function CalculationImportModal({
  open,
  onOpenChange,
  entity,
  onImported,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entity:
    | { type: "lead"; id: string }
    | { type: "deal"; id: string };
  onImported: (estimateId: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [stage, setStage] = useState<"upload" | "parsing" | "preview">("upload");
  const [workbook, setWorkbook] = useState<ImportedWorkbook | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string>("");
  const [editable, setEditable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const draftStorageKey = getDraftStorageKey(entity);
  const [hasDraft, setHasDraft] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return Boolean(window.localStorage.getItem(draftStorageKey));
  });

  const endpoint =
    entity.type === "lead"
      ? `/api/leads/${entity.id}/estimates/import-excel`
      : `/api/deals/${entity.id}/estimates/import-excel`;

  const onPickFile = async (file: File) => {
    setBusy(true);
    setError(null);
    setStage("parsing");
    setSelectedFileName(file.name);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("preview", "1");
      const result = await postFormData<PreviewResponse>(endpoint, fd);
      setWorkbook(result.workbook);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(draftStorageKey, JSON.stringify(result.workbook));
        setHasDraft(true);
      }
      setStage("preview");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Помилка розпізнавання Excel");
      setStage("upload");
    } finally {
      setBusy(false);
    }
  };

  const confirmImport = async () => {
    if (!workbook) return;
    setBusy(true);
    setError(null);
    try {
      const result = await postJson<ApplyResponse>(
        endpoint,
        {
          apply: true,
          workbook,
          sourceFileName: selectedFileName || workbook.fileName,
        },
      );
      if (result.estimate?.id) {
        if (typeof window !== "undefined") {
          window.localStorage.removeItem(draftStorageKey);
          setHasDraft(false);
        }
        onImported(result.estimate.id);
        onOpenChange(false);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Помилка імпорту");
    } finally {
      setBusy(false);
    }
  };

  const updateWorkbook = (next: ImportedWorkbook) => {
    setWorkbook(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(draftStorageKey, JSON.stringify(next));
      setHasDraft(true);
    }
  };

  const restoreDraft = () => {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem(draftStorageKey);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as ImportedWorkbook;
      if (!parsed || !Array.isArray(parsed.sheets)) return;
      setWorkbook(parsed);
      setSelectedFileName(parsed.fileName || "");
      setStage("preview");
      setError(null);
    } catch {
      window.localStorage.removeItem(draftStorageKey);
      setHasDraft(false);
    }
  };

  const clearDraft = () => {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(draftStorageKey);
    setHasDraft(false);
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[80] bg-black/45" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[90] max-h-[90vh] w-[min(1120px,calc(100%-24px))] -translate-x-1/2 -translate-y-1/2 overflow-auto rounded-xl border border-slate-200 bg-white p-4 shadow-xl">
          <div className="flex items-start justify-between gap-3">
            <div>
              <Dialog.Title className="text-base font-semibold text-slate-900">
                Імпорт з Excel
              </Dialog.Title>
              <Dialog.Description className="text-xs text-slate-500">
                Завантажте Excel, перевірте блоки товарів, підтвердіть імпорт у версію розрахунку.
              </Dialog.Description>
            </div>
            <Dialog.Close className={btnGhost}>Закрити</Dialog.Close>
          </div>

          {error ? (
            <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              {error}
            </p>
          ) : null}

          {stage === "upload" ? (
            <div
              className="mt-4 space-y-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4"
              onDragOver={(e) => {
                e.preventDefault();
              }}
              onDrop={(e) => {
                e.preventDefault();
                const file = e.dataTransfer.files?.[0];
                if (!file) return;
                void onPickFile(file);
              }}
            >
              <input
                ref={inputRef}
                type="file"
                accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                className="hidden"
                onChange={(e) => {
                  const file = e.currentTarget.files?.[0];
                  if (!file) return;
                  void onPickFile(file);
                  e.currentTarget.value = "";
                }}
              />
              <button
                type="button"
                className={btnPrimary}
                onClick={() => inputRef.current?.click()}
              >
                Завантажити Excel
              </button>
              {hasDraft ? (
                <div className="flex flex-wrap gap-2">
                  <button type="button" className={btnGhost} onClick={restoreDraft}>
                    Відновити чернетку
                  </button>
                  <button type="button" className={btnGhost} onClick={clearDraft}>
                    Очистити чернетку
                  </button>
                </div>
              ) : null}
              <p className="text-xs text-slate-500">
                Drag & drop: перетягніть файл у цю область.
              </p>
            </div>
          ) : null}

          {stage === "parsing" ? (
            <div className="mt-4 flex items-center gap-2 text-sm text-slate-700">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
              Розпізнаємо таблиці…
            </div>
          ) : null}

          {stage === "preview" && workbook ? (
            <div className="mt-4 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className={btnGhost}
                  onClick={() => setEditable((v) => !v)}
                >
                  {editable ? "Завершити редагування" : "Редагувати"}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  className={btnPrimary}
                  onClick={() => void confirmImport()}
                >
                  {busy ? "Імпорт…" : "Підтвердити імпорт"}
                </button>
              </div>
              <CalculationImportPreview
                workbook={workbook}
                editable={editable}
                onChange={updateWorkbook}
              />
            </div>
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
