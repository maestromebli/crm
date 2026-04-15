"use client";

import { useState } from "react";
import Link from "next/link";
import { KanbanSquare, UserPlus } from "lucide-react";
import { NewLeadModal } from "./new-lead/NewLeadModal";

type LeadsToolbarProps = {
  view: string;
  canUploadLeadFiles?: boolean;
  canCreateLead?: boolean;
};

export function LeadsToolbar({
  view,
  canUploadLeadFiles = true,
  canCreateLead = true,
}: LeadsToolbarProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="flex flex-wrap items-center justify-end gap-2">
        {canCreateLead ? (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white shadow-md shadow-slate-900/15 transition hover:bg-slate-800"
          >
            <UserPlus className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
            Новий лід
          </button>
        ) : null}
        <Link
          href="/leads/pipeline"
          className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-[var(--enver-card)] px-3.5 py-2.5 text-xs font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-[var(--enver-hover)]"
        >
          <KanbanSquare className="h-3.5 w-3.5 text-slate-500" aria-hidden />
          Воронка
        </Link>
        {view !== "all" ? (
          <Link
            href="/leads"
            className="text-xs text-slate-500 underline-offset-2 hover:text-slate-800 hover:underline"
          >
            Усі ліди
          </Link>
        ) : null}
      </div>
      {canCreateLead ? (
        <NewLeadModal
          open={open}
          onClose={() => setOpen(false)}
          canUploadFiles={canUploadLeadFiles}
        />
      ) : null}
    </>
  );
}
