"use client";

import type { AttachmentCategory } from "@prisma/client";
import Link from "next/link";
import type { Dispatch, SetStateAction } from "react";
import type {
  DealAttachmentSummary,
  DealWorkspacePayload,
} from "@/features/deal-workspace/types";
import type { ConstructorWorkspaceState } from "@/features/deal-workspace/deal-view-selectors";
import { cn } from "@/lib/utils";
import {
  ConstructorWorkspace,
  ConstructorWorkspaceTabs,
} from "../DealTransferHub";
import { ConstructorRoomPanel } from "../ConstructorRoomPanel";

const LEVELS = [
  "Новачок",
  "Виконавець",
  "Майстер",
  "Архітектор пакета",
] as const;

type Props = {
  dealId: string;
  constructorState: ConstructorWorkspaceState;
  constructorTab: "technical" | "files" | "comments" | "versions";
  onConstructorTabChange: Dispatch<
    SetStateAction<"technical" | "files" | "comments" | "versions">
  >;
  controlMeasurementReady: boolean;
  commercialSnapshotReady: boolean;
  selectedAttachmentIds: string[];
  setSelectedAttachmentIds: Dispatch<SetStateAction<string[]>>;
  attachments: DealAttachmentSummary[];
  filteredAttachments: DealAttachmentSummary[];
  fileSearch: string;
  setFileSearch: Dispatch<SetStateAction<string>>;
  categoryFilter: "all" | AttachmentCategory;
  setCategoryFilter: Dispatch<SetStateAction<"all" | AttachmentCategory>>;
  attachCategories: { value: AttachmentCategory; label: string }[];
  attachmentCategoryLabel: (category: AttachmentCategory) => string;
  busy: boolean;
  notesDraft: string;
  setNotesDraft: Dispatch<SetStateAction<string>>;
  onSavePackage: () => void;
  onSaveComment: () => void;
  constructorRoom: DealWorkspacePayload["constructorRoom"];
  btnGhostClassName: string;
};

export function ConstructorGamifiedModule({
  dealId,
  constructorState,
  constructorTab,
  onConstructorTabChange,
  controlMeasurementReady,
  commercialSnapshotReady,
  selectedAttachmentIds,
  setSelectedAttachmentIds,
  attachments,
  filteredAttachments,
  fileSearch,
  setFileSearch,
  categoryFilter,
  setCategoryFilter,
  attachCategories,
  attachmentCategoryLabel,
  busy,
  notesDraft,
  setNotesDraft,
  onSavePackage,
  onSaveComment,
  constructorRoom,
  btnGhostClassName,
}: Props) {
  const quests = [
    { id: "tech", label: "Технічні дані", done: constructorState.technicalReady },
    { id: "materials", label: "Комерційний пакет", done: constructorState.materialsReady },
    { id: "spec", label: "Специфікація", done: constructorState.specificationReady },
    { id: "drawings", label: "Креслення", done: constructorState.drawingsReady },
    { id: "files", label: "Файли передачі", done: constructorState.filesReady },
  ];
  const doneCount = quests.filter((item) => item.done).length;
  const progressPct = Math.round((doneCount / quests.length) * 100);
  const xp = doneCount * 120 + constructorState.commentsCount * 8;
  const level = LEVELS[Math.min(LEVELS.length - 1, Math.floor(doneCount / 2))];
  const nextQuest = quests.find((item) => !item.done)?.label ?? "Усі ключові квести виконано";

  return (
    <ConstructorWorkspace state={constructorState}>
      <section className="mt-3 rounded-xl border border-violet-200 bg-gradient-to-r from-violet-50 to-sky-50 p-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-violet-700">
          Constructor XP
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full bg-violet-700 px-2 py-0.5 font-medium text-white">
            Рівень: {level}
          </span>
          <span className="rounded-full border border-violet-200 bg-white px-2 py-0.5 text-violet-800">
            XP: {xp}
          </span>
          <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-slate-700">
            Прогрес: {doneCount}/{quests.length}
          </span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/80">
          <div className="h-full rounded-full bg-violet-600 transition-all" style={{ width: `${progressPct}%` }} />
        </div>
        <p className="mt-2 text-[11px] text-violet-900">Наступний квест: {nextQuest}</p>
      </section>

      <ConstructorWorkspaceTabs value={constructorTab} onChange={onConstructorTabChange} />
      {constructorTab === "technical" ? (
        <div className="mt-3 grid gap-2 text-xs text-slate-700 sm:grid-cols-2">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
            <p className="font-medium">Замір</p>
            <p className="mt-1 text-[11px] text-slate-600">
              {controlMeasurementReady
                ? "Замір заповнений, дані доступні."
                : "Замір ще не заповнений."}
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
            <p className="font-medium">Комерційна частина</p>
            <p className="mt-1 text-[11px] text-slate-600">
              {commercialSnapshotReady
                ? "Комерційний пакет сформовано й зафіксовано."
                : "Специфікація ще не сформована."}
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-2 sm:col-span-2">
            <p className="font-medium">Швидкі переходи</p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              <Link href={`/deals/${dealId}/workspace?tab=measurement`} className={btnGhostClassName}>
                Відкрити замір
              </Link>
              <Link href={`/deals/${dealId}/workspace?tab=proposal`} className={btnGhostClassName}>
                Відкрити КП
              </Link>
            </div>
          </div>
        </div>
      ) : null}
      {constructorTab === "files" ? (
        <div className="mt-3 rounded-lg border border-slate-100 bg-slate-50 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-medium text-slate-700">
              Файли для передачі: {selectedAttachmentIds.length}/{attachments.length}
            </p>
          </div>
          {attachments.length > 0 ? (
            <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
              <label className="block min-w-0 flex-1 text-[11px]">
                <span className="text-slate-500">Пошук за назвою або типом</span>
                <input
                  value={fileSearch}
                  onChange={(e) => setFileSearch(e.target.value)}
                  placeholder="Наприклад: договір, креслення…"
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs"
                />
              </label>
              <label className="block text-[11px] sm:w-44">
                <span className="text-slate-500">Категорія</span>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value as "all" | AttachmentCategory)}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs"
                >
                  <option value="all">Усі категорії</option>
                  {attachCategories.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          ) : null}
          <ul className="mt-2 max-h-56 space-y-1.5 overflow-y-auto text-xs">
            {filteredAttachments.map((a) => {
              const checked = selectedAttachmentIds.includes(a.id);
              return (
                <li
                  key={a.id}
                  className="flex items-start gap-2 rounded-md border border-transparent bg-white/60 px-1.5 py-1 hover:border-slate-200"
                >
                  <input
                    type="checkbox"
                    className="mt-0.5 shrink-0"
                    checked={checked}
                    onChange={(e) => {
                      setSelectedAttachmentIds((prev) =>
                        e.target.checked
                          ? [...new Set([...prev, a.id])]
                          : prev.filter((id) => id !== a.id),
                      );
                    }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-slate-800">{a.fileName}</div>
                    <div className="text-[11px] text-slate-500">
                      {attachmentCategoryLabel(a.category)}
                      {a.isCurrentVersion ? "" : " · неактуальна версія"} · v{a.version}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
          <button
            type="button"
            disabled={busy}
            className={cn(btnGhostClassName, "mt-2")}
            onClick={onSavePackage}
          >
            {busy ? "Збереження…" : "Зберегти склад пакета"}
          </button>
        </div>
      ) : null}
      {constructorTab === "comments" ? (
        <div className="mt-3">
          <label className="block text-xs">
            <span className="text-slate-500">Коментар конструктора / менеджера</span>
            <textarea
              value={notesDraft}
              onChange={(e) => setNotesDraft(e.target.value)}
              rows={4}
              className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
            />
          </label>
          <button
            type="button"
            disabled={busy}
            className={cn(btnGhostClassName, "mt-2")}
            onClick={onSaveComment}
          >
            {busy ? "Збереження…" : "Зберегти коментар"}
          </button>
          <ConstructorRoomPanel dealId={dealId} canUse={true} initialRoom={constructorRoom} />
        </div>
      ) : null}
      {constructorTab === "versions" ? (
        <div className="mt-3 space-y-1.5 text-xs text-slate-700">
          <p>Коментарів у кімнаті: {constructorState.commentsCount}</p>
          <p>Вкладення: {constructorState.versionsCount} файлів</p>
          <ul className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-[11px]">
            {attachments.slice(0, 6).map((item) => (
              <li key={item.id}>
                {item.fileName} · v{item.version} · {item.isCurrentVersion ? "актуальна" : "архів"}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </ConstructorWorkspace>
  );
}
