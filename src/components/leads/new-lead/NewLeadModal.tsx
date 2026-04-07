"use client";

import type { AttachmentCategory } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { postFormData, postJson } from "../../../lib/api/patch-json";
import { LEAD_CREATE_FILE_WARNINGS_KEY } from "../../../lib/leads/lead-file-warnings-storage";
import { normalizePhoneDigits } from "../../../lib/leads/phone-normalize";
import { cn } from "../../../lib/utils";
import { DuplicateWarning, type DuplicateMatches } from "./DuplicateWarning";
import { ExpandedLeadForm } from "./ExpandedLeadForm";
import { QuickLeadForm, type Assignee } from "./QuickLeadForm";

export type NewLeadModalProps = {
  open: boolean;
  onClose: () => void;
  canUploadFiles?: boolean;
};

function telFromPhone(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  if (t.startsWith("+")) return `tel:${t.replace(/\s/g, "")}`;
  const d = normalizePhoneDigits(t);
  if (d.length < 9) return null;
  return `tel:+${d}`;
}

export function NewLeadModal({
  open,
  onClose,
  canUploadFiles = true,
}: NewLeadModalProps) {
  const router = useRouter();
  const { data: session } = useSession();
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [assignees, setAssignees] = useState<Assignee[]>([]);
  const [assigneesLoading, setAssigneesLoading] = useState(false);
  const [ownerId, setOwnerId] = useState("");

  const [contactName, setContactName] = useState("");
  const [phone, setPhone] = useState("");
  const [source, setSource] = useState("");
  const [comment, setComment] = useState("");
  const [expanded, setExpanded] = useState(false);

  const [email, setEmail] = useState("");
  const [city, setCity] = useState("");
  const [title, setTitle] = useState("");
  const [objectType, setObjectType] = useState("");
  const [budget, setBudget] = useState("");
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [fileCategory, setFileCategory] =
    useState<AttachmentCategory>("OTHER");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [dupMatches, setDupMatches] = useState<DuplicateMatches | null>(null);
  const [dupLoading, setDupLoading] = useState(false);
  const dupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetForm = () => {
    setContactName("");
    setPhone("");
    setSource("");
    setComment("");
    setOwnerId("");
    setEmail("");
    setCity("");
    setTitle("");
    setObjectType("");
    setBudget("");
    setPendingFiles([]);
    setFileCategory("OTHER");
    setExpanded(false);
    setDupMatches(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setErr(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setAssigneesLoading(true);
    void (async () => {
      try {
        const r = await fetch("/api/leads/assignees");
        const j = (await r.json()) as {
          assignees?: Assignee[];
          error?: string;
        };
        if (cancelled) return;
        if (!r.ok) {
          setAssignees([]);
          if (session?.user?.id) setOwnerId(session.user.id);
          return;
        }
        const list = j.assignees ?? [];
        setAssignees(list);
        const sid = session?.user?.id;
        if (sid && list.some((a) => a.id === sid)) {
          setOwnerId(sid);
        } else if (list[0]) {
          setOwnerId(list[0].id);
        } else if (sid) {
          setOwnerId(sid);
        }
      } catch {
        if (!cancelled) {
          setAssignees([]);
          if (session?.user?.id) setOwnerId(session.user.id);
        }
      } finally {
        if (!cancelled) setAssigneesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, session?.user?.id]);

  const runPhoneCheck = useCallback(async (raw: string) => {
    const d = normalizePhoneDigits(raw);
    if (d.length < 8) {
      setDupMatches(null);
      return;
    }
    setDupLoading(true);
    try {
      const r = await fetch(
        `/api/leads/check-phone?phone=${encodeURIComponent(raw)}`,
      );
      const j = (await r.json()) as {
        matches?: DuplicateMatches;
        error?: string;
      };
      if (!r.ok) {
        setDupMatches(null);
        return;
      }
      setDupMatches(Array.isArray(j.matches) ? j.matches : []);
    } catch {
      setDupMatches(null);
    } finally {
      setDupLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    if (dupTimer.current) clearTimeout(dupTimer.current);
    dupTimer.current = setTimeout(() => {
      void runPhoneCheck(phone);
    }, 450);
    return () => {
      if (dupTimer.current) clearTimeout(dupTimer.current);
    };
  }, [open, phone, runPhoneCheck]);

  if (!open) return null;

  const buildPayload = () => {
    const name = contactName.trim();
    const ph = phone.trim();
    if (!name && !ph) {
      return { error: "Вкажіть імʼя або телефон." as const };
    }

    const noteParts: string[] = [];
    if (city.trim()) noteParts.push(`Місто: ${city.trim()}`);
    if (objectType.trim()) noteParts.push(`Тип об'єкта: ${objectType.trim()}`);
    if (budget.trim()) noteParts.push(`Бюджет: ${budget.trim()}`);
    if (comment.trim()) noteParts.push(comment.trim());
    const note = noteParts.length ? noteParts.join("\n") : null;

    const src = source.trim() || "Вручну";
    let leadTitle = title.trim();
    if (!leadTitle) {
      leadTitle = [objectType.trim(), name || ph].filter(Boolean).join(" · ");
      if (!leadTitle) leadTitle = ph || name || "Новий лід";
    }

    const oid = ownerId.trim() || session?.user?.id;
    if (!oid) {
      return {
        error: "Не вдалося визначити відповідального. Оновіть сторінку." as const,
      };
    }

    return {
      leadTitle,
      name,
      ph,
      src,
      note,
      oid,
      email: email.trim(),
      useMultipart: canUploadFiles && pendingFiles.length > 0,
    };
  };

  const submit = async (mode: "default" | "call" | "task") => {
    setErr(null);
    const p = buildPayload();
    if ("error" in p) {
      setErr(p.error);
      return;
    }

    setSaving(true);
    try {
      let j: { error?: string; id?: string; uploadErrors?: string[] };
      if (p.useMultipart) {
        const fd = new FormData();
        fd.append("title", p.leadTitle);
        if (p.name) fd.append("contactName", p.name);
        if (p.ph) fd.append("phone", p.ph);
        fd.append("email", p.email);
        fd.append("source", p.src);
        if (p.note) fd.append("note", p.note);
        fd.append("ownerId", p.oid);
        fd.append("fileCategory", fileCategory);
        for (const f of pendingFiles) {
          fd.append("files", f);
        }
        j = await postFormData<{
          error?: string;
          id?: string;
          uploadErrors?: string[];
        }>("/api/leads", fd);
      } else {
        j = await postJson<{ error?: string; id?: string; uploadErrors?: string[] }>(
          "/api/leads",
          {
            title: p.leadTitle,
            contactName: p.name || undefined,
            phone: p.ph || undefined,
            email: p.email || null,
            source: p.src,
            note: p.note,
            ownerId: p.oid,
          },
        );
      }
      if (j.uploadErrors?.length && j.id) {
        try {
          sessionStorage.setItem(
            LEAD_CREATE_FILE_WARNINGS_KEY,
            JSON.stringify({ leadId: j.id, messages: j.uploadErrors }),
          );
        } catch {
          /* ignore */
        }
      }
      resetForm();
      onClose();
      router.refresh();

      if (j.id) {
        const goFiles = p.useMultipart || Boolean(j.uploadErrors?.length);
        if (goFiles) {
          router.push(`/leads/${j.id}/files`);
          return;
        }
        if (mode === "task") {
          router.push(`/leads/${j.id}/tasks?new=1`);
          return;
        }
        if (mode === "call") {
          const tel = telFromPhone(p.ph);
          router.push(`/leads/${j.id}?fresh=1`);
          if (tel) {
            window.location.href = tel;
          }
          return;
        }
        router.push(`/leads/${j.id}?fresh=1`);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Помилка");
    } finally {
      setSaving(false);
    }
  };

  const input =
    "w-full rounded-md border border-slate-200 bg-[var(--enver-card)] px-2 py-1 text-xs outline-none focus:border-slate-900";

  return (
    <div
      className="fixed inset-0 z-40 flex justify-end bg-slate-900/40 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-lead-title"
    >
      <div className="flex h-full w-full max-w-md flex-col border-l border-slate-200/90 bg-[var(--enver-card)] shadow-2xl sm:rounded-l-2xl">
        <header className="flex items-start justify-between gap-3 border-b border-slate-100 bg-gradient-to-r from-white to-slate-50/90 px-4 py-4 sm:px-5">
          <div>
            <p
              id="new-lead-title"
              className="text-base font-semibold tracking-tight text-[var(--enver-text)]"
            >
              Новий лід
            </p>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              Мінімум полів зараз — решту в картці Hub після збереження.
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="shrink-0 rounded-lg px-2 py-1 text-xs font-medium text-slate-500 transition hover:bg-slate-100 hover:text-[var(--enver-text)]"
          >
            Закрити
          </button>
        </header>

        <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3 text-xs">
          {err ? (
            <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-800">
              {err}
            </p>
          ) : null}

          <QuickLeadForm
            inputClass={input}
            contactName={contactName}
            onContactNameChange={setContactName}
            phone={phone}
            onPhoneChange={setPhone}
            duplicateSlot={
              <DuplicateWarning loading={dupLoading} matches={dupMatches} />
            }
            source={source}
            onSourceChange={setSource}
            comment={comment}
            onCommentChange={setComment}
            assigneesLoading={assigneesLoading}
            assignees={assignees}
            ownerId={ownerId}
            onOwnerIdChange={setOwnerId}
            sessionNameOrEmail={
              session?.user?.name ?? session?.user?.email ?? undefined
            }
          />

          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="w-full rounded-lg border border-dashed border-slate-300 py-2 text-[11px] font-medium text-slate-600 hover:bg-[var(--enver-hover)]"
          >
            {expanded
              ? "Сховати розширені поля"
              : "Розширені поля (email, місто, тип меблів, файли…)"}
          </button>

          {expanded ? (
            <ExpandedLeadForm
              inputClass={input}
              email={email}
              onEmailChange={setEmail}
              city={city}
              onCityChange={setCity}
              title={title}
              onTitleChange={setTitle}
              objectType={objectType}
              onObjectTypeChange={setObjectType}
              budget={budget}
              onBudgetChange={setBudget}
              canUploadFiles={canUploadFiles}
              fileCategory={fileCategory}
              onFileCategoryChange={setFileCategory}
              fileInputRef={fileInputRef}
              pendingFilesCount={pendingFiles.length}
              onFilesSelected={setPendingFiles}
            />
          ) : null}
        </div>

        <footer className="space-y-2 border-t border-slate-200 px-4 py-2.5">
          <div className="flex flex-col gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={() => void submit("default")}
              className={cn(
                "w-full rounded-full bg-slate-900 py-2.5 text-xs font-semibold text-white shadow-md shadow-slate-900/20 transition hover:bg-slate-800",
                saving && "opacity-70",
              )}
            >
              {saving ? "Зберігаю…" : "Створити й відкрити Hub"}
            </button>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={saving}
                onClick={() => void submit("call")}
                className="flex-1 rounded-full border border-slate-200 py-2 text-[11px] font-medium text-slate-800 hover:bg-[var(--enver-hover)]"
              >
                Створити й подзвонити
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void submit("task")}
                className="flex-1 rounded-full border border-slate-200 py-2 text-[11px] font-medium text-slate-800 hover:bg-[var(--enver-hover)]"
              >
                Створити й задачу
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="w-full text-[11px] text-slate-500 hover:text-slate-800"
          >
            Скасувати
          </button>
        </footer>
      </div>
    </div>
  );
}
