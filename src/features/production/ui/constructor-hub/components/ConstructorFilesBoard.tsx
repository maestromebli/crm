"use client";

import { Download, Eye, FileBadge, MessageSquare, Search, Star } from "lucide-react";
import { useMemo, useState } from "react";
import { FILE_CATEGORY_LABEL } from "../constructor-hub.labels";
import type { ConstructorFile, ConstructorFileCategory } from "../constructor-hub.types";

export function ConstructorFilesBoard({ files }: { files: ConstructorFile[] }) {
  const [category, setCategory] = useState<"ALL" | ConstructorFileCategory>("ALL");
  const [approvedOnly, setApprovedOnly] = useState(false);
  const [mineOnly, setMineOnly] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return files.filter((file) => {
      if (category !== "ALL" && file.category !== category) return false;
      if (approvedOnly && !file.approved) return false;
      if (mineOnly && !file.mine) return false;
      if (q && !file.fileName.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [files, category, approvedOnly, mineOnly, query]);

  const current = filtered.filter((file) => !file.archived);
  const archived = filtered.filter((file) => file.archived);

  return (
    <section id="files" className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-slate-900">Файли</h3>
        <label className="relative">
          <Search className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Пошук за назвою файлу"
            className="rounded-lg border border-slate-200 py-2 pl-8 pr-2 text-sm"
          />
        </label>
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as "ALL" | ConstructorFileCategory)}
          className="rounded-lg border border-slate-200 px-2 py-1.5"
        >
          <option value="ALL">Усі категорії</option>
          {Object.entries(FILE_CATEGORY_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setApprovedOnly((v) => !v)}
          className={`rounded-lg border px-2 py-1.5 ${approvedOnly ? "border-emerald-300 bg-emerald-50" : "border-slate-200"}`}
        >
          Тільки погоджені
        </button>
        <button
          type="button"
          onClick={() => setMineOnly((v) => !v)}
          className={`rounded-lg border px-2 py-1.5 ${mineOnly ? "border-sky-300 bg-sky-50" : "border-slate-200"}`}
        >
          Лише мої
        </button>
      </div>

      <FileSection title="Актуальні" items={current} />
      <FileSection title="Архів / Історія" items={archived} />
    </section>
  );
}

function FileSection({ title, items }: { title: string; items: ConstructorFile[] }) {
  return (
    <div>
      <h4 className="mb-2 text-sm font-semibold text-slate-800">{title}</h4>
      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-5 text-center text-sm text-slate-500">
          У цьому розділі немає файлів.
        </div>
      ) : (
        <div className="grid gap-2 md:grid-cols-2">
          {items.map((file) => (
            <article key={file.id} className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-slate-900">{file.fileName}</p>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    {FILE_CATEGORY_LABEL[file.category]} · {file.versionLabel}
                  </p>
                </div>
                <span className="rounded-full bg-white px-2 py-0.5 text-[11px] text-slate-700">{file.extension.toUpperCase()}</span>
              </div>
              <p className="mt-1 text-[11px] text-slate-500">
                {file.uploadedBy} · {new Date(file.uploadedAt).toLocaleString("uk-UA")}
              </p>

              <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
                {file.approved ? <Badge className="border-emerald-200 bg-emerald-50 text-emerald-900">Погоджено</Badge> : null}
                {file.important ? <Badge className="border-amber-200 bg-amber-50 text-amber-900">Важливо</Badge> : null}
              </div>

              <div className="mt-3 flex flex-wrap gap-1">
                <Action icon={Eye} label="Перегляд" />
                <Action icon={Download} label="Завантажити" />
                <Action icon={MessageSquare} label={`Коментарі (${file.comments.length})`} />
                <Action icon={Star} label="Позначити важливим" />
              </div>
              {file.comments[0] ? (
                <p className="mt-2 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600">
                  {file.comments[0].authorName}: {file.comments[0].text}
                </p>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function Action({ icon: Icon, label }: { icon: React.ComponentType<{ className?: string }>; label: string }) {
  return (
    <button type="button" className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-slate-700 hover:bg-slate-50">
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

function Badge({ children, className }: { children: React.ReactNode; className: string }) {
  return <span className={`rounded-full border px-2 py-0.5 ${className}`}>{children}</span>;
}
