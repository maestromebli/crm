import type { ReactNode } from "react";
import { cn } from "../../../lib/utils";

export type Assignee = { id: string; name: string | null; email: string };

function formatAssignee(a: Assignee): string {
  return a.name?.trim() || a.email;
}

type QuickLeadFormProps = {
  inputClass: string;
  contactName: string;
  onContactNameChange: (v: string) => void;
  phone: string;
  onPhoneChange: (v: string) => void;
  duplicateSlot: ReactNode;
  source: string;
  onSourceChange: (v: string) => void;
  comment: string;
  onCommentChange: (v: string) => void;
  assigneesLoading: boolean;
  assignees: Assignee[];
  ownerId: string;
  onOwnerIdChange: (v: string) => void;
  sessionNameOrEmail: string | null | undefined;
};

export function QuickLeadForm({
  inputClass,
  contactName,
  onContactNameChange,
  phone,
  onPhoneChange,
  duplicateSlot,
  source,
  onSourceChange,
  comment,
  onCommentChange,
  assigneesLoading,
  assignees,
  ownerId,
  onOwnerIdChange,
  sessionNameOrEmail,
}: QuickLeadFormProps) {
  return (
    <>
      <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2.5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          Швидке створення
        </p>
        <label className="block space-y-0.5">
          <span className="text-[11px] font-medium text-slate-700">Імʼя</span>
          <input
            className={inputClass}
            value={contactName}
            onChange={(e) => onContactNameChange(e.target.value)}
            autoComplete="name"
            placeholder="Як звертатись"
          />
        </label>
        <label className="block space-y-0.5">
          <span className="text-[11px] font-medium text-slate-700">
            Телефон
          </span>
          <input
            className={inputClass}
            value={phone}
            onChange={(e) => onPhoneChange(e.target.value)}
            autoComplete="tel"
            placeholder="+380…"
          />
        </label>
        {duplicateSlot}
        <p className="text-[10px] text-slate-500">
          Потрібно хоча б імʼя або телефон.
        </p>
        <label className="block space-y-0.5">
          <span className="text-[11px] font-medium text-slate-700">
            Джерело<span className="text-rose-500">*</span>
          </span>
          <input
            className={inputClass}
            value={source}
            onChange={(e) => onSourceChange(e.target.value)}
            placeholder="Сайт, Instagram, рекомендація…"
          />
        </label>
        <label className="block space-y-0.5">
          <span className="text-[11px] font-medium text-slate-600">
            Коментар
          </span>
          <textarea
            className={cn(inputClass, "min-h-[64px] resize-y")}
            value={comment}
            onChange={(e) => onCommentChange(e.target.value)}
            placeholder="Коротко: що потрібно клієнту"
          />
        </label>
      </div>

      <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2.5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          Відповідальний
        </p>
        {assigneesLoading ? (
          <p className="text-[11px] text-slate-500">Завантаження…</p>
        ) : assignees.length <= 1 ? (
          <p className="text-[11px] text-slate-700">
            {assignees[0]
              ? formatAssignee(assignees[0])
              : sessionNameOrEmail ?? "—"}
          </p>
        ) : (
          <select
            className={inputClass}
            value={ownerId}
            onChange={(e) => onOwnerIdChange(e.target.value)}
          >
            {assignees.map((a) => (
              <option key={a.id} value={a.id}>
                {formatAssignee(a)}
              </option>
            ))}
          </select>
        )}
      </div>
    </>
  );
}
