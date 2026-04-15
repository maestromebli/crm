"use client";

import { Download, Eye, GitCompareArrows, SendHorizonal, Star } from "lucide-react";
import { VERSION_STATUS_LABEL, VERSION_TYPE_LABEL } from "../constructor-hub.labels";
import type { ConstructorVersion } from "../constructor-hub.types";

export function ConstructorVersionsPanel({ versions }: { versions: ConstructorVersion[] }) {
  return (
    <section id="versions" className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-base font-semibold text-slate-900">Версії</h3>
      {versions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-5 text-center text-sm text-slate-500">
          Версій поки немає.
        </div>
      ) : (
        <ul className="space-y-2">
          {versions.map((version) => (
            <li key={version.id} className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-900">{version.versionLabel}</p>
                <div className="flex gap-1.5 text-[11px]">
                  <span className="rounded-full bg-white px-2 py-0.5 text-slate-700">{VERSION_TYPE_LABEL[version.type]}</span>
                  <span className="rounded-full bg-white px-2 py-0.5 text-slate-700">{VERSION_STATUS_LABEL[version.approvalStatus]}</span>
                </div>
              </div>
              <p className="mt-1 text-xs text-slate-600">{version.changeSummary}</p>
              <p className="mt-1 text-[11px] text-slate-500">
                {version.uploadedBy} · {new Date(version.uploadedAt).toLocaleString("uk-UA")}
              </p>
              <div className="mt-2 flex flex-wrap gap-1 text-xs">
                <Action icon={Eye} label="Відкрити" />
                <Action icon={GitCompareArrows} label="Порівняти" />
                <Action icon={Download} label="Завантажити" />
                <Action icon={SendHorizonal} label="Надіслати на перевірку" />
                <Action icon={Star} label="Позначити як фінальну" />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
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
