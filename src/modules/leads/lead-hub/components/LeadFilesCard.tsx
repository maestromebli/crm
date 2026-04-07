"use client";

import type { DragEvent, RefObject } from "react";
import { useCallback, useState } from "react";
import Link from "next/link";
import type { LeadDetailRow } from "../../../../features/leads/queries";
import {
  LEAD_HUB_PRODUCT_BUCKETS,
  productBucketForCategory,
} from "../../../../lib/leads/lead-hub-file-groups";

type Props = {
  lead: LeadDetailRow;
  canUploadLeadFiles: boolean;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onPickFiles: (files: FileList | null) => void;
};

export function LeadFilesCard({
  lead,
  canUploadLeadFiles,
  fileInputRef,
  onPickFiles,
}: Props) {
  const [dragOver, setDragOver] = useState(false);

  const grouped = new Map<string, LeadDetailRow["attachments"]>();
  for (const b of LEAD_HUB_PRODUCT_BUCKETS) grouped.set(b.id, []);
  for (const a of lead.attachments) {
    const bid = productBucketForCategory(a.category);
    grouped.get(bid)?.push(a);
  }

  const bucketCounts = LEAD_HUB_PRODUCT_BUCKETS.map((b) => ({
    ...b,
    count: grouped.get(b.id)?.length ?? 0,
  }));

  const recent = [...lead.attachments]
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
    .slice(0, 6);

  const onDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (canUploadLeadFiles) setDragOver(true);
  }, [canUploadLeadFiles]);

  const onDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }, []);

  const onDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOver(false);
      if (!canUploadLeadFiles) return;
      const dt = e.dataTransfer?.files;
      if (dt?.length) onPickFiles(dt);
    },
    [canUploadLeadFiles, onPickFiles],
  );

  return (
    <section
      id="lead-files"
      className={`rounded-[12px] border bg-[var(--enver-card)] p-4 shadow-[var(--enver-shadow)] transition-colors duration-200 ${
        dragOver
          ? "border-[#2563EB] ring-2 ring-[#2563EB]/20"
          : "border-[var(--enver-border)]"
      }`}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[18px] font-medium text-[var(--enver-text)]">
          Файли
          <span className="ml-1.5 text-[12px] font-normal text-[var(--enver-muted)]">
            ({lead.attachments.length})
          </span>
        </h3>
        <div className="flex items-center gap-2">
          {canUploadLeadFiles ? (
            <>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip"
                onChange={(e) => onPickFiles(e.target.files)}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-[11px] font-medium text-slate-800 underline"
              >
                Додати
              </button>
            </>
          ) : null}
          <Link
            href={`/leads/${lead.id}/files`}
            className="text-[11px] font-medium text-slate-700 underline"
          >
            Усі →
          </Link>
        </div>
      </div>

      {canUploadLeadFiles ? (
        <p className="mt-1 text-[10px] text-slate-500">
          Перетягніть файли сюди — категорія підставиться автоматично за типом
          імені.
        </p>
      ) : null}

      <ul className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
        {bucketCounts.map((b) => (
          <li
            key={b.id}
            className="rounded-lg border border-slate-100 bg-slate-50/90 px-2 py-1.5 text-[10px]"
          >
            <span className="font-medium text-slate-800">{b.labelUa}</span>
            <span className="ml-1 text-slate-500">({b.count})</span>
          </li>
        ))}
      </ul>

      <ul className="mt-2 space-y-1 border-t border-slate-100 pt-2">
        {recent.length === 0 ? (
          <li className="text-[11px] text-slate-500">Поки без вкладень.</li>
        ) : (
          recent.map((f) => (
            <li key={f.id} className="truncate text-[11px]">
              <a
                href={f.fileUrl}
                target="_blank"
                rel="noreferrer"
                className="text-slate-800 underline"
              >
                {f.fileName}
              </a>
            </li>
          ))
        )}
      </ul>
    </section>
  );
}
